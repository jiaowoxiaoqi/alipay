(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Alipay = factory());
}(this, (function () {'use strict';

            var axios = window.axios || require('axios');
            /* */
            const apiUris = {
                getAlipayUserId: "/api/alipay/GetAlipayUserId",
                getKeyConfig: "/api/alipay/GetKeyConfig",
                mapAlipayUserId: "/api/Alipay/MapAlipayUserId",
                createVoucher: "/api/KouBeiPay/SendPaymentVoucher",
                getUri: function(uri) {
                    // return configuration.uriGateway + uri;
                    return configuration.uriSmartAlipay + uri;
                }
            }
            function getAuthStatus() { //获取local中的AlipayAuth
                return JSON.parse(localStorage.getItem('alipayAuth'))
            }
            function parseAlipayUserId(result) { //正则获取userId
                var userId = /user_id=[\w]+/.exec(result["result"])[0].substr(8);
                return userId;
            }
            async function httpGet(uri, input) {//axios.get
                var response = await axios.get(apiUris.getUri(uri), { params: input }).catch(error => {
                    return false
                    // onError(error);
                });
                return response;
            }
            async function httpPost(uri, input) {//axios.post
                var response = await axios.post(apiUris.getUri(uri), input).catch(error => {
                    return false
                    // onError(error);
                });
                return response;
            }


            //第三方授权插件
            async function pluginOpenAuth(alipayAuthSettings) {
                return new Promise(function(resolve, reject) {
                    // reject({ memo: "mock error" });
                    // reject({ memo: "报错" });
                    // resolve("2088602014149791")
                    window.plugins.aliPay.auth(alipayAuthSettings, function(result) {
                        var alipayUserId = parseAlipayUserId(result);
                        resolve(alipayUserId);
                    }, function(error) {
                        reject(error);
                    })
                });

            }

            //启动支付宝APP插件
            async function pluginStartApp() {
                // 扫码支付  alipays://platformapi/startapp?appId=20000056&tab=2
                // 条码支付  alipays://platformapi/startapp?appId=20000056&tab=3
                var uri = "alipays://platformapi/startapp?appId=20000056&tab=3";
                return new Promise(function(resolve, reject) {
                    // resolve(true);
                    window.plugins.startApp.start(uri, function(result) {
                        console.log("startApp->" + JSON.stringify(result));
                        resolve(true);
                    }, function(error) {
                        onError(error);
                        reject(error);
                    })
                });
            }

            var smartAlipay = function({ store,router }) {
                this.$store = store;
                this.router=router;
                this.identityInstace = store.state.identity;
            
                this.stepData = {
                    index: 0,
                    msg: "处理中..."
                }
            
                this.KEY_ALIPAYUSERID = "alipayUserId";
            
                this.isSameAlipayUserId = function(alipayUserId) {
                    return this.identityInstace.alipayUserId == alipayUserId;
                }
                this.getAlipayUserId = async function() {
                    if (this.identityInstace.alipayUserId)
                        return true;
                    var response = await httpGet(apiUris.getAlipayUserId, { userId: this.identityInstace.userId });
                    this.$store.commit('setAlipayUserId', response);
                    //response 1.接口失败false 2.成功数据为空 3.成功
                    return response
                }
                this.getOpenAuthSettings = async function() {
                    if (this.identityInstace.alipayAuthSettings)
                        return true;
                    var response = await httpGet(apiUris.getKeyConfig, { tenantId: this.identityInstace.tenantId });
                    this.$store.commit('setAlipayAuthSettings', response);
                    //response 1.接口失败false 2.成功数据为空 3.成功
                    return response
                }
                this.mapAlipayUserId = async function(result) {
                    var input = {
                        alipayUserId: result
                    }
                    this.$store.commit("setAlipayUserId", result);
                    var response = await httpPost(apiUris.mapAlipayUserId, input);
                }
                this.createVoucher = async function(input) {
                    var response = await httpPost(apiUris.createVoucher, input);
                    return response;
                }
            };
            smartAlipay.prototype.prepareAuth = async function() {
                this.stepData = {
                    index: 0,
                    msg: "处理中..."
                }
                this.$store.commit("setStepData", this.stepData);
                        
                if (!this.identityInstace.alipayUserId) {
                    if (!await this.getOpenAuthSettings())
                        return false;
                    if (!await this.getAlipayUserId())
                        return false;
                }
                // this.$store.commit("setIsInEXAlipay");
                this.$store.commit("setStepData", this.stepData);
                return true;
            }
            smartAlipay.prototype.auth = async function(successHandler) {
                var self = this;
                pluginOpenAuth(this.identityInstace.alipayAuthSettings).then(
                    function(result) {
                        self.mapAlipayUserId(result);
                        // self.stepData.index = 1;
                        successHandler();
                    },
                    function(error) {
                        self.stepData = { index: -1, msg: error.memo };
                        console.log("auth error->" + error);
                    }).finally(function() {
                    self.$store.commit('setStepData', self.stepData);
                })
            }
            smartAlipay.prototype.preparePay = async function(input) {
                var self = this;
                self.stepData = {
                    index: 0,
                    msg: "处理中..."
                }
                self.$store.commit('setStepData', self.stepData);
                await self.getAlipayUserId();
                await self.getOpenAuthSettings();
                await pluginOpenAuth(this.identityInstace.alipayAuthSettings).then(
                    function(result) {
                        if (self.isSameAlipayUserId(result)) {
                            // self.stepData.index = 2;
                            return self.stepData = { index: 2, msg: self.stepData.msg };
                            
                        }
                        // self.stepData.index = 3;
                        return self.stepData = { index: 3, msg: self.stepData.msg };
                    },
                    function(error) {
                        // self.stepData.index = 1;
                        // self.stepData.msg = error.memo;
                        return self.stepData = { index: 1, msg: error.memo };
                    }).finally(function() {
                    self.$store.commit('setStepData', self.stepData);
                });
                console.log("pluginOpenAuth:" + self.stepData.index);
                if (self.stepData.index != 2)
                    return;
                if (!input) {
                    self.pay('hasCreateVoucher')
                    return;
                }
                self.$store.commit('setStepData', { index: 4 });
                var response = await self.createVoucher(input);
                if (!response) {
                    self.$store.commit('setStepData', { index: 99 });
                    return;
                }
                setTimeout(function() {
                    self.$store.commit('setStepData', { index: 5 });
                }, 1000);
            }
            smartAlipay.prototype.pay = function(type) {
                this.$store.commit('setReloadAlipayResultPopup', true);
                //this.setReloadAlipayResultPopup(true);
                if (type != 'hasCreateVoucher') {
                    this.$store.commit('setStepData', { index: 100 });
                }
                var self=this;
                pluginStartApp().then(
                    function() {
                        // var f7 = new Framework7();
                        // f7.popup('#alipayResult');
                        self.router.load({ url:'/pay/AlipayResult/',reload:true})
                    },
                    function(error) {
            
                    });
            }

        })
    )
) 
