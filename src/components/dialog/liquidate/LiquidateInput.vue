<template>
  <div class="liquidate-input">
    <template v-if="!waiting">
      <liquidate-list
        v-if="!accountSelected"
        :data="data"
        @selected="setLiquidationAccount"
      />
      <div v-else>
        <v-row class="mx-6 px-6 mb-3">
          <h1>
            Collateral Available to liquidate:
          </h1>
        </v-row>
        <v-row class="mx-6 px-6">
          <p class="text-justify">
            As collaterals are not necessarily expressed in the same token as the market,
            you may need to liquidate them in other tokens.
          </p>
        </v-row>
        <v-row class="my-4 d-flex align-center">
          <v-col cols="4">
            <v-row class="d-flex justify-center">
              <h2>Collateral</h2>
            </v-row>
            <v-row class="d-flex justify-center">
              <h3>
                {{maxToLiquidate}}
              </h3>
              <span>
                {{data.token.symbol}}
              </span>
            </v-row>
          </v-col>
          <v-divider vertical inset/>
          <v-col cols="7" class="input-col">
            <v-row class="inputBox">
              <v-col cols="10">
                <v-text-field class="inputText" full-width single-line solo flat
                              type="number" v-model="amount" required
                              :rules="[rules.required, rules.decimals,
                              rules.funds, rules.maxAvailable]"/>
              </v-col>
              <v-col cols="2">
                <v-btn @click="maxAmount = true" class="pa-0" text color="#008CFF">max</v-btn>
              </v-col>
            </v-row>
            <v-row class="mx-0 my-4 px-1 d-flex align-center">
              <v-col cols="2">
                <h4>
                  You pay:
                </h4>
              </v-col>
              <v-col cols="6" class="summary-num d-flex justify-center">
                {{collateralAmount}}
              </v-col>
              <v-col cols="2">
                <span>{{borrowMarketSymbol}}</span>
              </v-col>
              <v-col cols="2" class="d-flex justify-end">
                <span>
                 {{usdAmount}} USD
                </span>
              </v-col>
            </v-row>
            <v-row class="mx-0 my-4 px-1 d-flex align-center">
              <v-col cols="2">
                <h4>
                  You get:
                </h4>
              </v-col>
              <v-col cols="6" class="summary-num d-flex justify-center">
                {{liquidationAmount}}
              </v-col>
              <v-col cols="2">
                <span>{{data.token.symbol}}</span>
              </v-col>
              <v-col cols="2" class="d-flex justify-end">
                <span>
                  {{usdAmount}} USD
                </span>
              </v-col>
            </v-row>
            <v-row class="px-1 mt-6 d-flex justify-center">
              <h5>
                Would you like to
                <a href="">buy more tokens?</a>
              </h5>
            </v-row>
          </v-col>
        </v-row>
        <v-row class="my-6 d-flex justify-center">
          <v-btn class="button" rounded color="#008CFF" @click="liquidate">
            Liquidate account
          </v-btn>
        </v-row>
      </div>
    </template>
    <template v-else>
      <loader/>
    </template>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import LiquidateList from '@/components/dialog/liquidate/LiquidateList.vue';
import Loader from '@/components/common/Loader.vue';

export default {
  name: 'LiquidateInput',
  props: {
    data: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      waiting: false,
      liquidationAccount: '',
      accountSelected: false,
      accountDebt: 0,
      borrowMarketAddress: '',
      borrowMarketPrice: 0,
      currentMarketPrice: 0,
      borrowMarketTokenDecimals: 0,
      maxToLiquidate: 0,
      borrowMarketSymbol: '',
      amount: '0',
      funds: 0,
      rules: {
        required: () => !!Number(this.amount) || 'Required.',
        decimals: () => this.decimalPositions || `Maximum ${this.data.token
          .decimals} decimal places for ${this.data.token.symbol}.`,
        funds: () => this.funds >= this.amount || 'Not enough funds',
        maxAvailable: () => this.amount <= this.maxToLiquidate
          || 'There is not enough collateral to liquidate',
      },
    };
  },
  methods: {
    liquidate() {
      this.waiting = true;
      this.$emit('wait');
      const market = new this.$rbank.Market(this.borrowMarketAddress);
      market.liquidateBorrow(
        this.liquidationAccount,
        this.collateralAmount * (10 ** this.borrowMarketTokenDecimals),
        this.data.market.address,
        this.account,
      )
        .then((res) => {
          this.waiting = false;
          this.$emit('succeed', {
            hash: res.transactionHash,
            borrowLimitInfo: this.borrowLimitInfo,
            liquidationAmount: this.collateralAmount,
          });
          console.log(res);
        });
    },
    setLiquidationAccount(accountObject) {
      this.borrowMarketAddress = accountObject.borrowMarketAddress;
      this.$rbank.controller.eventualMarketPrice(this.borrowMarketAddress)
        .then((price) => { this.borrowMarketPrice = price; });
      this.$rbank.controller.eventualMarketPrice(this.data.market.address)
        .then((price) => { this.currentMarketPrice = price; });
      this.getCollateralToken();
      this.liquidationAccount = accountObject.borrower;
      this.accountDebt = accountObject.debt;
      this.maxToLiquidate = accountObject.maxToLiquidate;
      this.accountSelected = true;
    },
    actionSucceed(succeedObj) {
      this.emit('succeed', succeedObj);
    },
    getCollateralToken() {
      new this.$rbank.Market(this.borrowMarketAddress).eventualToken
        .then((token) => Promise.all([token.eventualSymbol, token.eventualDecimals,
          token.eventualBalanceOf(this.account)]))
        .then(([symbol, decimals, balance]) => {
          this.borrowMarketSymbol = symbol;
          this.borrowMarketTokenDecimals = decimals;
          this.funds = balance;
        });
    },
  },
  computed: {
    ...mapState({
      account: (state) => state.Session.account,
    }),
    usdAmount() {
      return (this.amount * this.currentMarketPrice);
    },
    hasDecimals() {
      return !!Number(this.data.token.decimals);
    },
    numberOfDecimals() {
      return this.amount.includes('.') ? (this.amount.substring(this.amount.indexOf('.') + 1, this
        .amount.length).length <= this.data.token.decimals) : true;
    },
    decimalPositions() {
      return this.hasDecimals ? this.numberOfDecimals : !this.amount.includes('.');
    },
    contractAmount() {
      return this.borrowMarketTokenDecimals
        ? this.amount / 10 ** this.borrowMarketTokenDecimals : this.amount;
    },
    collateralAmount() {
      return ((this.amount * this.currentMarketPrice) / this.borrowMarketPrice)
        .toFixed(this.borrowMarketTokenDecimals);
    },
    liquidationAmount() {
      return Number(Number(this.amount).toFixed(this.data.token.decimals));
    },
  },
  components: {
    Loader,
    LiquidateList,
  },
};
</script>