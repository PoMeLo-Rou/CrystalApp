Page({
  data: {
    hotBeads: [
      { id: 1, name: '极光紫晶', price: 5.5, color: '#9b59b6' },
      { id: 2, name: '马粉', price: 3.0, color: '#ffcdd2' },
      { id: 3, name: '蓝月光', price: 8.0, color: '#81d4fa' },
      { id: 4, name: '钛晶', price: 12.0, color: '#ffd700' }
    ]
  },
  goToDIY() {
    wx.switchTab({ url: '/pages/diy/diy' })
  }
})