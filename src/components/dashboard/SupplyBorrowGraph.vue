<template>
  <div class="supply-borrow-chart">
    <div>
      <v-row class="ma-0">
        <h1>My Supply-Borrow Factor:</h1>
      </v-row>
      <v-row class="ma-0">
        <span>TruBank Collateral Factor: </span><span class="ml-4">75%</span>
      </v-row>
      <v-row class="ma-0 pt-1">
        <v-col cols="5" class="pa-0">
          <v-divider/>
        </v-col>
        <v-col/>
      </v-row>
    </div>
    <v-row class="ma-0 d-flex align-center">
      <v-col cols="3">
        <v-row class="d-flex justify-end">
          <h2 class="text-center">Supplied</h2>
        </v-row>
        <v-row class="d-flex justify-end">
          <template v-if="totalSupplied.toString().length > 4">
            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <p class="blackish" v-bind="attrs" v-on="on">{{ totalSupplied | formatPrice }}</p>
                <span class="ml-2">USD</span>
              </template>
              <span>{{ totalSupplied | fullPrice }}</span>
            </v-tooltip>
          </template>
          <template v-else>
            <p class="blackish">{{ totalSupplied | formatPrice }}</p>
            <span class="ml-2">USD</span>
          </template>
        </v-row>
      </v-col>
      <v-col cols="6" class="d-flex justify-center">
        <GChart v-if="supplyBorrow" type="PieChart" :data="chartData" :options="chartOptions"
                :resizeDebounce="500"/>
        <GChart v-else type="PieChart" :data="emptyChart" :options="chartOptions"
                :resizeDebounce="500"/>
      </v-col>
      <v-col cols="3">
        <v-row class="d-flex justify-start">
          <h3 class="text-center">Borrowed</h3>
        </v-row>
        <v-row class="d-flex justify-start">
          <template v-if="totalBorrowed.toString().length > 4">
            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <p class="blackish text-center" v-bind="attrs" v-on="on">
                  {{ totalBorrowed | formatPrice }}
                  <span class="ml-2">USD</span>
                </p>
              </template>
              <span>{{ totalBorrowed | fullPrice }}</span>
            </v-tooltip>
          </template>
          <template v-else>
            <p class="blackish text-center">
              {{ totalBorrowed | formatPrice }}
              <span class="ml-2">USD</span>
            </p>
          </template>
        </v-row>
      </v-col>
    </v-row>
    <div>
      <v-row class="d-flex justify-center">
        <h4>Overall Borrow limit</h4>
      </v-row>
      <v-row class="borrow-limit d-flex justify-center">
        <template v-if="totalSupplied.toString().length > 4">
          <v-tooltip bottom>
            <template v-slot:activator="{ on, attrs }">
              <p class="blackish mb-0" v-bind="attrs" v-on="on">
                {{ totalBorrowLimit | formatPrice }}
              </p>
            </template>
            <span>{{ totalBorrowLimit | fullPrice }}</span>
          </v-tooltip>
        </template>
        <template v-else>
          <p class="blackish">{{ totalBorrowLimit | formatPrice }}</p>
        </template>
      </v-row>
      <v-row class="d-flex justify-center">
        <span>USD</span>
      </v-row>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { GChart } from 'vue-google-charts';

export default {
  name: 'SupplyBorrowGraph',
  components: {
    GChart,
  },
  data() {
    return {
      totalBorrowed: 0,
      totalSupplied: 0,
      totalBorrowLimit: 0,
      emptyChart: [
        ['Type', 'Value'],
        ['data', 1],
      ],
      chartData: [
        ['Type', 'Value'],
        ['Supplied', 0],
        ['Borrowed', 0],
      ],
      chartOptions: {
        width: 200,
        height: 200,
        legend: 'none',
        pieSliceText: 'none',
        fontName: 'Rubik',
        colors: ['#008CFF', '#828282'],
        pieHole: 0.7,
        chartArea: {
          width: '100%',
          height: '100%',
        },
      },
    };
  },
  computed: {
    ...mapState({
      account: (state) => state.Session.account,
    }),
    supplyBorrow() {
      return !!this.totalBorrowed || !!this.totalSupply;
    },
  },
  methods: {
    getData() {
      this.$controller.getAccountValues(this.account)
        .then(({ supplyValue, borrowValue }) => {
          this.totalBorrowed = borrowValue;
          this.totalSupplied = supplyValue;
          this.getBorrowLimit();
          this.updateDiagramData();
        });
    },
    getBorrowLimit() {
      this.$controller.getAccountLiquidity(this.account)
        .then((liquidity) => {
          this.totalBorrowLimit = liquidity / 2;
        });
    },
    updateDiagramData() {
      this.chartData = [
        ['Type', 'Value'],
        ['Supplied', this.totalSupplied],
        ['Borrowed', this.totalBorrowed],
      ];
    },
  },
  created() {
    this.getData();
  },
};
</script>

<style scoped>

</style>
