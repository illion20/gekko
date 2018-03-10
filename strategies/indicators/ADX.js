// required indicators
var RMA = require('./RMA.js');

var Indicator = function(config) {
  this.input = 'candle';

  this.ADX = new RMA(config.ADXLength);
  this.ATR = new RMA(config.DILength);
  this.DIM = new RMA(config.DILength);
  this.DIP = new RMA(config.DILength);

  this.lastCandle = false;
}

Indicator.prototype.update = function(candle) {
  if(!this.lastCandle) this.lastCandle = candle;

  let up = candle.high - this.lastCandle.high;
  let down = -(candle.low - this.lastCandle.low);
  let plusDM = up > down && up > 0 ? up : 0;
  let minusDM = down > up && down > 0 ? down : 0;
  let tr = Math.max(candle.high - candle.low, Math.abs(candle.high - this.lastCandle.close), Math.abs(candle.low - this.lastCandle.close));
  this.ATR.update(tr);
  this.DIP.update(plusDM);
  this.DIM.update(minusDM);
  let trur = this.ATR.result;
  let plus = 100 * this.DIP.result / trur;
  let minus = 100 * this.DIM.result / trur;
  let sum = plus + minus;
  this.ADX.update(Math.abs(plus - minus) / (sum == 0 ? 1 : sum));
  this.result = 100 * this.ADX.result;

  this.lastCandle = candle;
}

module.exports = Indicator;
