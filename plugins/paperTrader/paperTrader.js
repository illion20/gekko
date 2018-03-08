const _ = require('lodash');

const util = require('../../core/util');
const ENV = util.gekkoEnv();
const config = util.getConfig();
const calcConfig = config.paperTrader;
const watchConfig = config.watch;

const PaperTrader = function() {
  _.bindAll(this);

  this.fee = 1 - (calcConfig['fee' + calcConfig.feeUsing.charAt(0).toUpperCase() + calcConfig.feeUsing.slice(1)] + calcConfig.slippage) / 100;

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.portfolio = {
    asset: calcConfig.simulationBalance.asset,
    currency: calcConfig.simulationBalance.currency,
    balance: false
  }
}

// teach our paper trader events
util.makeEventEmitter(PaperTrader);

PaperTrader.prototype.relayTrade = function(advice) {
  var what = advice.recommendation;
  var price = advice.candle.close;
  var at = advice.candle.start;

  let action;
  if(what === 'short')
    action = 'short';
  else if(what === 'long')
    action = 'long';
  else if(what === 'close')
    action = 'close';
  else
    return;

  this.emit('trade', {
    action,
    price,
    portfolio: _.clone(this.portfolio),
    balance: this.portfolio.asset,
    date: at
  });
}

PaperTrader.prototype.relayPortfolio = function() {
  this.emit('portfolioUpdate', _.clone(this.portfolio));
}

PaperTrader.prototype.extractFee = function(amount) {
  amount *= 1e8;
  amount *= this.fee;
  amount = Math.floor(amount);
  amount /= 1e8;
  return amount;
}

PaperTrader.prototype.setStartBalance = function() {
  this.portfolio.balance = this.portfolio.asset;//this.price * this.portfolio.asset;
  this.relayPortfolio();
}

// after every succesfull trend ride we hopefully end up
// with more BTC than we started with, this function
// calculates Gekko's profit in %.
PaperTrader.prototype.updatePosition = function(advice) {
  let what = advice.recommendation;
  let price = advice.candle.close;

  // virtually trade all {currency} to {asset}
  // at the current price (minus fees)
  if((what === 'close' && this.lastWhat === 'short') || (what === 'long' && this.lastWhat === 'short')) {
    this.portfolio.asset = this.extractFee(this.portfolio.asset + (this.portfolio.asset * this.lastPrice - this.portfolio.asset * price) / price);
  } else if((what === 'close' && this.lastWhat === 'long') || (what === 'short' && this.lastWhat === 'long')) {
    this.portfolio.asset = this.extractFee(this.portfolio.asset + (this.portfolio.asset * price - this.portfolio.asset * this.lastPrice) / price);
  }
  if (what === 'short' || what === 'long') {
    this.trades++;
    this.portfolio.asset = this.extractFee(this.portfolio.asset);
  }

  this.lastPrice = price;
  this.lastWhat = what;
}

PaperTrader.prototype.processAdvice = function(advice) {
  if(advice.recommendation === 'soft')
    return;

  this.updatePosition(advice);
  this.relayTrade(advice);
}

PaperTrader.prototype.processCandle = function(candle, done) {
  this.price = candle.close;

  if(!this.portfolio.balance)
    this.setStartBalance();

  done();
}

module.exports = PaperTrader;
