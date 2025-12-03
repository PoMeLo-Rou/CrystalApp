Page({
  data: {
    cartList: [],
    totalMoney: '0.00'
  },
  onShow() {
    this.loadCart();
  },
  loadCart() {
    const list = wx.getStorageSync('my_cart') || [];
    // 计算总价
    let sum = 0;
    list.forEach(item => sum += parseFloat(item.price));
    this.setData({
      cartList: list,
      totalMoney: sum.toFixed(2)
    });
  },
  deleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.cartList;
    list.splice(index, 1);
    wx.setStorageSync('my_cart', list);
    this.loadCart();
    wx.showToast({ title: '已删除', icon: 'none' });
  },
  goShopping() {
    wx.switchTab({ url: '/pages/diy/diy' });
  },
  onPay() {
    wx.showToast({ title: '演示模式，暂不支持支付', icon: 'none' });
  }
})