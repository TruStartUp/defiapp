import ControllerContract from '@/contracts/Controller.json';
import Market from '@/handlers/market';
import { send, web3 } from '@/handlers';
import * as constants from '@/store/constants';
import _ from 'lodash';

/**
 * A blockchain transaction response.
 * @typedef {Object} TXResult
 */

export default class Controller {
  /**
   * Controller handler constructor.
   * @param {string} address On chain `Controller` deployed address.
   * @return {Error}
   */
  constructor(address = '') {
    this.instanceAddress = address; // TODO .toLowerCase();
    if (!this.address.match(/0x[a-fA-F0-9]{40}/)) return new Error('Missing address');
    this.instance = new web3.eth.Contract(ControllerContract.abi, address);
  }

  /**
   * Controller address.
   * @return {string} this controller instance address.
   */
  get address() {
    return this.instanceAddress;
  }

  /**
   * Controller deploy block.
   * @return {Number} this controller deploy block.
   */
  get eventualDeployBlock() {
    return new Promise((resolve, reject) => {
      this.instance.methods.deployBlock()
        .call()
        .then((block) => Number(block))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns an eventual value for the collateral factor.
   * @return {Promise<number>} eventual collateral factor.
   */
  get eventualCollateralFactor() {
    return new Promise((resolve, reject) => {
      this.eventualMantissa
        .then((mantissa) => [
          mantissa,
          this.instance.methods.collateralFactor().call(),
        ])
        .then((promises) => Promise.all(promises))
        .then(([mantissa, collateralFactor]) => Number(collateralFactor / mantissa))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns an eventual value for the liquidation factor.
   * @return {Promise<number>} eventual liquidation factor.
   */
  get eventualLiquidationFactor() {
    return new Promise((resolve, reject) => {
      this.eventualMantissa
        .then((mantissa) => [
          mantissa,
          this.instance.methods.liquidationFactor().call(),
        ])
        .then((promises) => Promise.all(promises))
        .then(([mantissa, liquidationFactor]) => Number(liquidationFactor / mantissa))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns an eventual value for the size of registered markets
   * within this controller.
   * @return {Promise<number>} eventual market list size.
   */
  get eventualMarketListSize() {
    return new Promise((resolve, reject) => {
      this.instance.methods.marketListSize()
        .call()
        .then((marketListSize) => Number(marketListSize))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the eventual controller owner.
   * @return {Promise<string>} eventual controller owner.
   */
  get eventualOwner() {
    return new Promise((resolve, reject) => {
      this.instance.methods.owner()
        .call()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the eventual mantissa.
   * @return {Promise<number>} eventual controller mantissa.
   */
  get eventualMantissa() {
    return new Promise((resolve, reject) => {
      this.instance.methods.MANTISSA()
        .call()
        .then((mantissa) => Number(mantissa))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns an array with the blocks series according to the period
   * @param period string the period over the calculation is based
   * @return {Promise<[number]>} a promise to a result array block numbers
   */
  getPastBlockNumbers(period) {
    const pastBlockNumbers = [];
    const blocksPerYear = 1000000;
    let labelsPerPeriod;
    let blocksPerPeriod;
    switch (period) {
      case constants.PERIOD_DAY:
        labelsPerPeriod = 12;
        blocksPerPeriod = Math.floor(blocksPerYear / (365.25 * 12));
        break;
      case constants.PERIOD_WEEK:
        labelsPerPeriod = 7;
        blocksPerPeriod = Math.floor(blocksPerYear / 365.25);
        break;
      case constants.PERIOD_MONTH:
        labelsPerPeriod = 15;
        blocksPerPeriod = Math.floor((blocksPerYear * 2) / (365.25));
        break;
      case constants.PERIOD_YEAR:
        labelsPerPeriod = 12;
        blocksPerPeriod = Math.floor((blocksPerYear) / (12));
        break;
      default:
        labelsPerPeriod = 7;
        blocksPerPeriod = Math.floor(blocksPerYear / 365.25);
    }
    return new Promise((resolve, reject) => {
      Promise.all([this.eventualDeployBlock, web3.eth.getBlockNumber()])
        .then(([deployBlock, currentBlockNumber]) => {
          _.range(labelsPerPeriod).forEach((i) => {
            const pastBlockNumber = currentBlockNumber - (blocksPerPeriod * i) >= deployBlock
              ? currentBlockNumber - (blocksPerPeriod * i) : deployBlock;
            pastBlockNumbers.push(pastBlockNumber);
          });
          resolve(pastBlockNumbers);
        })
        .catch(reject);
    });
  }

  /**
   * Returns an two dimensional array with the balance of an account through a given period
   * @param {string} from An account
   * @param {string} period over the balances ('day', 'week', 'month', 'year')
   * @return {Promise<[[object, number]]>} an array of arrays with the timestamp
   * and the balance value of the account
   */
  getOverallBalance(from, period = constants.PERIOD_WEEK) {
    return new Promise((resolve, reject) => {
      this.getPastBlockNumbers(period)
        .then((pastBlockNumbers) => {
          const pastAccountValuesPromises = Promise.all(pastBlockNumbers
            .map((blockNumber) => {
              const controller = new Controller(this.address);
              controller.setDefaultBlock(blockNumber);
              return controller.getAccountValues(from);
            }));
          const pastBlocksPromise = Promise.all(pastBlockNumbers
            .map((blockNumber) => web3.eth.getBlock(blockNumber)));
          return Promise.all([pastAccountValuesPromises, pastBlocksPromise]);
        })
        .then(([pastAccountValues, pastBlocks]) => {
          const overallBalances = pastAccountValues
            .map(({ supplyValue, borrowValue }, idx) => {
              const balance = supplyValue - borrowValue;
              const time = new Date(pastBlocks[idx].timestamp * 1000);
              return [time, balance];
            });
          resolve(overallBalances);
        })
        .catch(reject);
    });
  }

  /**
   * Modifies the instance default block
   * @param blockNumber Number new default block
   */
  setDefaultBlock(blockNumber) {
    this.instance.defaultBlock = blockNumber;
  }

  /**
   * Sets the collateral factor for this controller.
   * @param {number} collateralFactor
   * @return {Promise<TXResult>}
   */
  setCollateralFactor(collateralFactor) {
    return new Promise((resolve, reject) => {
      this.eventualMantissa
        .then((mantissa) => send(
          this.instance.methods.setCollateralFactor(collateralFactor * mantissa),
        ))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Sets the liquidation factor for this controller.
   * @param {number} liquidationFactor
   * @return {Promise<TXResult>}
   */
  setLiquidationFactor(liquidationFactor) {
    return new Promise((resolve, reject) => {
      this.eventualMantissa
        .then((mantissa) => send(
          this.instance.methods.setLiquidationFactor(liquidationFactor * mantissa),
        ))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Adds a new market into this controller. Fails if the market was already added.
   * @param {string} marketAddress address of an existing market on chain.
   * @return {Promise<TXResult>}
   */
  addMarket(marketAddress) {
    return new Promise((resolve, reject) => {
      send(this.instance.methods.addMarket(marketAddress))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Sets the price in USD for a given market
   * @param {string} marketAddress address of the registered market in this controller.
   * @param {number} marketPrice the new price for the given market.
   * @return {Promise<TXResult>}
   */
  setMarketPrice(marketAddress, marketPrice) {
    return new Promise((resolve, reject) => {
      this.eventualMantissa
        .then((mantissa) => send(this.instance.methods
          .setPrice(marketAddress, Number(marketPrice) * Number(mantissa))))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the current price for a given market.
   * @param marketAddress address of the registered market in this controller.
   * @return {Promise<number>} eventual price for a given market in this controller.
   */
  eventualMarketPrice(marketAddress) {
    return new Promise((resolve, reject) => {
      Promise.all([
        this.eventualMantissa,
        this.instance.methods.prices(marketAddress).call(),
      ])
        .then(([mantissa, price]) => Number(price) / Number(mantissa))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Account values
   * @typedef {Object} AccountValues
   * @property {number} supplyValue
   * @property {number} borrowValue
   */

  /**
   * Returns the current supplied and borrowed values for a given account.
   * @param {string} account
   * @return {Promise<AccountValues>}
   */
  getAccountValues(account) {
    return new Promise((resolve, reject) => {
      this.instance.methods.getAccountValues(account)
        .call()
        .then(({ supplyValue, borrowValue }) => ({
          supplyValue: Number(supplyValue),
          borrowValue: Number(borrowValue),
        }))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the liquidity for a given account according to its current state in all the markets.
   * @param {string} account
   * @return {Promise<number>} eventual liquidity
   */
  getAccountLiquidity(account) {
    return new Promise((resolve, reject) => {
      this.instance.methods.getAccountLiquidity(account)
        .call()
        .then((liquidity) => Number(liquidity))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the health factor for a given account according to its current
   * state in all the markets.
   * @param {string} account
   * @return {Promise<number>} eventual health factor
   */
  getAccountHealth(account) {
    return new Promise((resolve, reject) => {
      Promise.all([this.eventualMantissa, this.getAccountValues(account)])
        .then(([mantissa, { borrowValue }]) => {
          if (borrowValue <= 0) resolve(1);
          return Promise.all([
            mantissa,
            this.instance.methods.getAccountHealth(account).call(),
          ]);
        })
        .then(([mantissa, accountHealth]) => Number(accountHealth) / mantissa)
        .then((accountHealth) => 1 / (1 + Math.exp(-accountHealth)))
        .then((sigmoidHealth) => (Number(sigmoidHealth) - 0.731059)
          / (0.999999 - 0.731059))
        .then((healthPercentage) => (healthPercentage < 0
          ? 0 : Number(healthPercentage.toFixed(6))))
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the address of the market registered at certain index.
   * @param {number} marketIdx Market index position
   * @return {Promise<string>}
   */
  getEventualMarketAddress(marketIdx) {
    return new Promise((resolve, reject) => {
      this.instance.methods.marketList(marketIdx)
        .call()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns an address if the markets exists, it would be the market address
   * otherwise it throws an error.
   * @param {string} tokenAddress
   * @return {Promise<string | Error>}
   */
  getEventualMarketAddressByToken(tokenAddress) {
    return new Promise((resolve, reject) => {
      this.instance.methods.marketsByToken(tokenAddress)
        .call()
        .then((marketAddress) => {
          if (marketAddress.match(/0x[0]{40}/)) throw new Error('Token address not registered');
          return marketAddress;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Validates either the current account or an specified one is the owner of this controller.
   * @param {string=} from the account used to determine property of this controller.
   * @return {Promise<boolean>} eventual answer of property validation.
   */
  eventualIsOwner(from = '') {
    return new Promise((resolve, reject) => {
      web3.eth.getAccounts()
        .then(([account]) => [
          account,
          this.instance.methods.owner().call(),
        ])
        .then((results) => Promise.all(results))
        .then(([account, registeredOwner]) => {
          if (from) { return from === registeredOwner; }
          return account === registeredOwner;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns the list of existing markets.
   * @return {Promise<[Market]>}
   */
  markets() {
    const config = {
      [process.env.VUE_APP_NETWORK_ID]: {
        httpProvider: process.env.VUE_APP_HTTP_PROVIDER,
        wsProvider: process.env.VUE_APP_WS_PROVIDER,
      },
    };
    return this.eventualMarketListSize
      .then((marketListSize) => _.range(marketListSize))
      .then((marketIdxs) => marketIdxs
        .map((marketIdx) => this.getEventualMarketAddress(marketIdx)))
      .then((eventualMarketAddresses) => Promise.all(eventualMarketAddresses))
      .then((marketAddresses) => marketAddresses
        .map((marketAddress) => new Market(marketAddress, config)));
  }

  /**
   * Returns the eventual market instances that are registered in the specified controller.
   * @return {Promise<[Market]>} eventual array of market instances.
   */
  get eventualMarkets() {
    return this.markets();
  }

  /**
   * Gets an eventual instance of the specified market either by its position in the market list or
   * by its on chain deployed market address.
   * @param {string|number} id either the position in the market list array or its on chain deployed
   * market address.
   * @return {Promise<Market>} eventual market instance
   */
  eventualMarket(id) {
    return new Promise((resolve, reject) => {
      if (typeof id === 'string') {
        this.markets()
          .then((markets) => markets.filter((market) => market.address === id)
            .pop())
          .then((result) => {
            if (result === undefined) {
              throw new Error('There is no market with that address');
            }
            return result;
          })
          .then(resolve)
          .catch(reject);
      }
      return this.markets()
        .then((markets) => markets[id])
        .then((result) => {
          if (result === undefined) {
            throw new Error('There is no market at this index');
          }
          return result;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Returns if the market with the given token address already exists.
   * @param tokenAddress
   * @return {Promise<boolean>}
   */
  marketExistsByToken(tokenAddress) {
    return new Promise((resolve) => {
      this.getEventualMarketAddressByToken(tokenAddress)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  }

  /**
   * Deploys a new controller on chain
   * @return {Promise<string>} the address of the created controller smart contract
   */
  static create() {
    return new Promise((resolve, reject) => {
      const controller = new web3.eth.Contract(ControllerContract.abi);
      const deploy = controller.deploy({ data: ControllerContract.bytecode });
      web3.eth.getAccounts()
        .then(([from]) => [from, deploy.estimateGas({ from })])
        .then((result) => Promise.all(result))
        .then(([from, gas]) => deploy.send({ from, gas }))
        // eslint-disable-next-line no-underscore-dangle
        .then((instance) => instance._address.toLowerCase())
        .then(resolve)
        .catch(reject);
    });
  }
}
