import Vue from 'vue';
import Controller from '@/handlers/controller';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';
import vuetify from './plugins/vuetify';
import 'roboto-fontface/css/roboto/roboto-fontface.css';
import '@mdi/font/css/materialdesignicons.css';
import './styles/main.scss';

require('./filters');

Vue.config.productionTip = false;
Vue.prototype.$controller = new Controller(process.env.VUE_APP_TRUBANK_CONTROLLER);
Vue.controller = Vue.prototype.$controller;

new Vue({
  router,
  store,
  vuetify,
  render: (h) => h(App),
}).$mount('#app');
