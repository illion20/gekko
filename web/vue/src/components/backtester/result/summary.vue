<template lang='jade'>
div.contain

  .grd-row.summary
    .grd-row-col-3-6
      table.p1
        tr
          th start time
          td {{ report.startTime }}
        tr
          th end time
          td {{ report.endTime }}
        tr
          th timespan
          td {{ report.timespan }}
        tr
          th start price
          td {{ round0(report.startPrice) }} {{ report.currency }}
        tr
          th end price
          td {{ round0(report.endPrice) }} {{ report.currency }}
        tr
          th market
          td {{ round2(report.market) }}%

    paperTradeSummary(:report='report')

</template>

<script>

import paperTradeSummary from '../../global/paperTradeSummary.vue'

export default {
  props: ['report'],
  components: {
    paperTradeSummary
  },
  methods: {
    round0: n => (+n).toFixed(0),
    round2: n => (+n).toFixed(2),
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

</style>
