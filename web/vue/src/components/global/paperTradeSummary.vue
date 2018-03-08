<template lang='jade'>
.grd-row-col-3-6
  table.p1
    tr
      th amount of trades
      td {{ report.trades }} ( {{ round2(100*report.ptrades/report.trades) }}% )
    tr
      th average winning trade
      td {{ round(report.avgWinTrade) }} {{ report.asset }}
    tr
      th average losing trade
      td {{ round(report.avgLosingTrade) }} {{ report.asset }}
    tr
      th sharpe ratio
      td {{ round2(report.sharpe) }}
    tr
      th max drawdown
      td {{ round0(report.drawdown) }} {{ report.currency }}
    tr
      th start balance
      td {{ round(report.startBalance) }} {{ report.asset }}
    tr
      th final balance
      td {{ round(report.balance) }} {{ report.asset }}
    tr
      th gross profit
      td {{ round(report.grossProfit) }} {{ report.asset }}
    tr
      th gross loss
      td {{ round(report.grossLoss) }} {{ report.asset }}
    tr
      th profit factor
      td {{ round2(report.profitFactor) }}
    tr
      th win rate
      td {{ round2(report.winRate) }}
    tr
      th simulated profit

  .big.txt--right.price(:class='profitClass') {{ round2(report.relativeProfit) }}%

</template>

<script>

export default {
  props: ['report'],
  methods: {
    round2: n => (+n).toFixed(2),
    round0: n => (+n).toFixed(0),
    round: n => (+n).toFixed(5)
  },
  computed: {
    profitClass: function() {
      if(this.report.relativeProfit > 0)
        return 'profit'
      else
        return 'loss'
    }
  }
}
</script>

<style>
.summary td {
  text-align: right;
}

.big {
  font-size: 1.3em;
  width: 80%;
}

.summary table {
  width: 80%;
}

.price.profit {
  color: #7FFF00;
}

.price.loss {
  color: red;
}

</style>
