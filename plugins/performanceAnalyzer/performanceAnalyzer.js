const _ = require('lodash');
const moment = require('moment');

const stats = require('../../core/stats');
const util = require('../../core/util');
const ENV = util.gekkoEnv();

const config = util.getConfig();
const perfConfig = config.performanceAnalyzer;
const watchConfig = config.watch;

// Load the proper module that handles the results
var Handler;
if(ENV === 'child-process')
Handler = require('./cpRelay');
else
Handler = require('./logger');

const PerformanceAnalyzer = function() {
  _.bindAll(this);

  this.dates = {
    start: false,
    end: false
  }

  this.startPrice = 0;
  this.endPrice = 0;

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.handler = new Handler(watchConfig);

  this.trades = 0;

  this.sharpe = 0;

  this.roundTrips = [];
  this.roundTrip = {
    id: 0,
    entry: false,
    exit: false,
    low: 0,
    side: 'none',
    drawdown: 0
  }
}

PerformanceAnalyzer.prototype.processCandle = function(candle, done) {
  this.price = candle.close;
  this.dates.end = candle.start;

  if(!this.dates.start) {
    this.dates.start = candle.start;
    this.startPrice = candle.close;
  }

  this.endPrice = candle.close;

  if(this.roundTrip.side === 'long' && this.roundTrip.drawdown > candle.close - this.roundTrip.entry.price) {
    this.roundTrip.drawdown = candle.close - this.roundTrip.entry.price;
  } else if(this.roundTrip.side === 'short' && this.roundTrip.drawdown > this.roundTrip.entry.price - candle.close) {
    this.roundTrip.drawdown = this.roundTrip.entry.price - candle.close;
  }

  done();
}

PerformanceAnalyzer.prototype.processPortfolioUpdate = function(portfolio) {
  this.start = portfolio;
  this.current = _.clone(portfolio);
}

PerformanceAnalyzer.prototype.processTrade = function(trade) {
  this.trades++;
  this.current = trade.portfolio;

  const report = this.calculateReportStatistics();
  this.handler.handleTrade(trade, report);

  this.logRoundtripPart(trade);
}

PerformanceAnalyzer.prototype.logRoundtripPart = function(trade) {
  if(trade.action === 'long' || trade.action === 'short') {
    if (this.roundTrip.entry) {
      this.roundTrip.exit = {
        date: trade.date,
        price: trade.price,
        total: trade.portfolio.asset,
      }
      this.handleRoundtrip();
    }
    this.roundTrip.entry = {
      date: trade.date,
      price: trade.price,
      total: trade.portfolio.asset,
    }
    //this.roundTrip.id++;
    this.roundTrip.exit = false;
    this.roundTrip.side = trade.action;
    this.roundTrip.drawdown = 0;

  } else if (trade.action === 'close') {
    if (this.roundTrip.entry) {
      this.roundTrip.exit = {
        date: trade.date,
        price: trade.price,
        total: trade.portfolio.asset,
      }
      this.handleRoundtrip();
      this.roundTrip.entry = false;
      this.roundTrip.side = 'none';
      this.roundTrip.drawdown = 0;
    }
  }
}
PerformanceAnalyzer.prototype.round = function(amount) {
  return amount.toFixed(8);
}

PerformanceAnalyzer.prototype.handleRoundtrip = function() {
  var roundtrip = {
    id: this.roundTrip.id,

    entryAt: this.roundTrip.entry.date,
    entryPrice: this.roundTrip.entry.price,
    entryBalance: this.roundTrip.entry.total,

    exitAt: this.roundTrip.exit.date,
    exitPrice: this.roundTrip.exit.price,
    exitBalance: this.roundTrip.exit.total,

    duration: this.roundTrip.exit.date.diff(this.roundTrip.entry.date),

    drawdown: this.roundTrip.drawdown
  }

  roundtrip.pnl = roundtrip.exitBalance - roundtrip.entryBalance;
  roundtrip.profit = (100 * roundtrip.exitBalance / roundtrip.entryBalance) - 100;

  this.roundTrips[this.roundTrip.id++] = roundtrip;

  // this will keep resending roundtrips, that is not ideal.. what do we do about it?
  this.handler.handleRoundtrip(roundtrip);

  // we need a cache for sharpe

  // every time we have a new roundtrip
  // update the cached sharpe ratio
  this.sharpe = stats.sharpe(
    this.roundTrips.map(r => r.profit),
    perfConfig.riskFreeReturn
  );
}

PerformanceAnalyzer.prototype.calculateReportStatistics = function() {
  // the portfolio's balance is measured in {currency}
  let balance = this.current.asset;//this.current.currency + this.price * this.current.asset;
  let profit = balance - this.start.balance;

  let timespan = moment.duration(
    this.dates.end.diff(this.dates.start)
  );
  let relativeProfit = balance / this.start.balance * 100 - 100

  let report = {
    currency: this.currency,
    asset: this.asset,

    startTime: this.dates.start.utc().format('YYYY-MM-DD HH:mm:ss'),
    endTime: this.dates.end.utc().format('YYYY-MM-DD HH:mm:ss'),
    timespan: timespan.humanize(),
    market: this.endPrice * 100 / this.startPrice - 100,

    balance: balance,
    profit: profit,
    relativeProfit: relativeProfit,

    yearlyProfit: this.round(profit / timespan.asYears()),
    relativeYearlyProfit: this.round(relativeProfit / timespan.asYears()),

    startPrice: this.startPrice,
    endPrice: this.endPrice,
    //trades: this.trades,
    trades: this.roundTrips.length,
    ptrades: _.filter(this.roundTrips, rt => { if (rt.exitBalance >= rt.entryBalance) return rt }).length,
    startBalance: this.start.balance,
    sharpe: this.sharpe,
    drawdown: Math.min.apply(0, this.roundTrips.map(function(elt) { return elt.drawdown; })),
    grossLoss: _.reduce(this.roundTrips, function(sum, rt) { return rt.exitBalance < rt.entryBalance ? sum + rt.exitBalance - rt.entryBalance : sum },0),
    grossProfit: _.reduce(this.roundTrips, function(sum, rt) { return rt.exitBalance > rt.entryBalance ? sum + rt.exitBalance - rt.entryBalance : sum },0)
  }

  report.alpha = report.profit - report.market;
  report.profitFactor = report.grossLoss != 0 ? Math.abs(report.grossProfit / report.grossLoss) : 0;
  report.avgWinTrade = report.ptrades == 0 ? 0 : report.grossProfit / report.ptrades;
  report.avgLosingTrade = report.trades - report.ptrades == 0 ? 0 : Math.abs(report.grossLoss) / (report.trades - report.ptrades);
  report.payOffRatio = report.avgWinTrade / report.avgLosingTrade;
  report.winRate = report.profitFactor + report.payOffRatio == 0 ? 0 : report.profitFactor / (report.profitFactor + report.payOffRatio);

  return report;
}

PerformanceAnalyzer.prototype.finalize = function(done) {
  const report = this.calculateReportStatistics();
  this.handler.finalize(report);
  done();
}


module.exports = PerformanceAnalyzer;
