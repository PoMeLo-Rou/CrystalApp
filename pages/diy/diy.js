// pages/diy/diy.js
Page({
  data: {
    rawBeadList: [
      { id: 1, name: '紫水晶', color: '#9b59b6', price: 5.5 },
      { id: 2, name: '粉晶',   color: '#ffcdd2', price: 3.0 },
      { id: 3, name: '海蓝宝', color: '#81d4fa', price: 8.0 },
      { id: 4, name: '金发晶', color: '#ffd700', price: 12.0 },
      { id: 5, name: '黑曜石', color: '#2c3e50', price: 4.0 },
      { id: 6, name: '红玛瑙', color: '#e74c3c', price: 6.0 }
    ],
    beadList: [],
    addedBeads: [],
    totalPrice: '0.00',
    isTrashHover: false,
    showClearConfirm: false
  },

  BEAD_GAP_RAD: 0.36, 
  canvasNode: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  canvasLeft: 0,
  canvasTop: 0,
  
  isDragging: false,
  draggingIndex: -1,
  originalAngleBeforeDrag: 0, 

  onLoad() {
    this.setData({ beadList: this.data.rawBeadList });
  },

  onReady() {
    setTimeout(() => { this.initCanvas(); }, 300);
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#braceletCanvas')
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = this.getPixelRatio();

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.canvasNode = canvas;
        this.ctx = ctx;
        this.canvasWidth = res[0].width;
        this.canvasHeight = res[0].height;
        this.canvasLeft = res[0].left;
        this.canvasTop = res[0].top;

        this.render();
      });
  },

  getPixelRatio() {
    if (typeof wx.getWindowInfo === 'function') {
      const info = wx.getWindowInfo();
      return info && info.pixelRatio ? info.pixelRatio : 1;
    }
    const legacyInfo = wx.getSystemInfoSync();
    return legacyInfo && legacyInfo.pixelRatio ? legacyInfo.pixelRatio : 1;
  },

  // 1. 智能添加 (修改版：严格顺时针)
  onSelectBead(e) {
    const bead = e.currentTarget.dataset.item;
    
    // 起始点：12点钟方向
    const startAngle = -Math.PI / 2;
    let foundAngle = null;

    // [核心修改] 
    // 不再调用 findNearestEmptySlot (那是给拖拽用的)
    // 而是写死一个循环：只向右(顺时针)寻找空位
    for (let i = 0; i < 50; i++) {
      // 每次向右挪一个间隔
      const testAngle = startAngle + (i * this.BEAD_GAP_RAD);
      
      // 只要这个位置没碰撞，就是它了
      if (!this.checkCollision(testAngle, -1)) {
        foundAngle = testAngle;
        break; 
      }
    }

    if (foundAngle === null) {
      wx.showToast({ title: '位置满啦', icon: 'none' });
      return;
    }

    const newBeadObj = {
      ...bead,
      uid: Date.now(),
      angle: foundAngle,
      x: 0, y: 0
    };
    
    this.updateDataAndRender([...this.data.addedBeads, newBeadObj]);
  },

  // 2. 角度归一化
  normalizeAngle(angle) {
    let res = angle;
    while (res <= -Math.PI) res += 2 * Math.PI;
    while (res > Math.PI) res -= 2 * Math.PI;
    return res;
  },

  // 3. 碰撞检测
  checkCollision(targetAngle, excludeIndex) {
    const beads = this.data.addedBeads;
    const normTarget = this.normalizeAngle(targetAngle);

    for (let i = 0; i < beads.length; i++) {
      if (i === excludeIndex) continue;
      
      const normBead = this.normalizeAngle(beads[i].angle);
      let diff = Math.abs(normTarget - normBead);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      
      if (diff < this.BEAD_GAP_RAD * 0.9) return true; // 0.9 稍微留点缝隙
    }
    return false;
  },

  // 4. [升级版] 寻找最近空位 (搜索全圆)
  findNearestEmptySlot(targetAngle, myIndex) {
    if (!this.checkCollision(targetAngle, myIndex)) {
      return targetAngle;
    }

    // 每次搜 1 度，搜 180 次（覆盖左右各 180 度 = 全圆）
    const step = 0.017; 
    const maxSteps = 180; 

    for (let i = 1; i <= maxSteps; i++) {
      const offset = i * step;
      // 搜右边
      if (!this.checkCollision(targetAngle + offset, myIndex)) return targetAngle + offset;
      // 搜左边
      if (!this.checkCollision(targetAngle - offset, myIndex)) return targetAngle - offset;
    }

    // 如果全圆都搜遍了还没位置，说明真满了
    return null; 
  },

  updateDataAndRender(newBeads) {
    const total = newBeads.reduce((sum, item) => sum + item.price, 0);
    this.setData({
      addedBeads: newBeads,
      totalPrice: total.toFixed(2)
    }, () => {
      this.render();
    });
  },

  // --- 保存图片 ---
  onSaveImage() {
    if (this.data.addedBeads.length === 0) return;
    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存', icon: 'success' })
        })
      }
    })
  },

  // --- 加入购物车 ---
  onAddToCart() {
    if (this.data.addedBeads.length === 0) return;

    const currentDesign = {
      id: Date.now(), // 订单ID
      beadCount: this.data.addedBeads.length,
      price: this.data.totalPrice,
      previewColor: this.data.addedBeads[0].color, // 取第一颗珠子颜色做展示
      time: new Date().toLocaleDateString()
    };

    // 存入本地缓存
    let cart = wx.getStorageSync('my_cart') || [];
    cart.unshift(currentDesign); // 加到最前面
    wx.setStorageSync('my_cart', cart);

    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  // --- 触摸事件 ---
  onTouchStart(e) {
    if (e.touches.length > 1) return;
    const { x, y } = e.touches[0];
    const touchX = x - this.canvasLeft;
    const touchY = y - this.canvasTop;

    const beads = this.data.addedBeads;
    for (let i = beads.length - 1; i >= 0; i--) {
      const dx = touchX - beads[i].x;
      const dy = touchY - beads[i].y;
      if (dx * dx + dy * dy < 35 * 35) { // 扩大点击判定区域
        this.isDragging = true;
        this.draggingIndex = i;
        this.originalAngleBeforeDrag = beads[i].angle;
        break;
      }
    }
  },

  onTouchMove(e) {
    if (!this.isDragging || this.draggingIndex === -1) return;

    const { x, y } = e.touches[0];
    const touchX = x - this.canvasLeft;
    const touchY = y - this.canvasTop;

    // 垃圾桶检测
    const distToRight = this.canvasWidth - touchX;
    const distToBottom = this.canvasHeight - touchY;
    if (distToRight < 80 && distToBottom < 80) {
      if (!this.data.isTrashHover) this.setData({ isTrashHover: true });
    } else {
      if (this.data.isTrashHover) this.setData({ isTrashHover: false });
    }

    // 跟手逻辑
    const targetBead = this.data.addedBeads[this.draggingIndex];
    targetBead.x = touchX;
    targetBead.y = touchY;

    this.render();
  },

  onTouchEnd() {
    // 1. 删除
    if (this.data.isTrashHover && this.draggingIndex !== -1) {
      const beads = this.data.addedBeads;
      beads.splice(this.draggingIndex, 1);
      this.updateDataAndRender(beads);
      wx.showToast({ title: '已删除', icon: 'none' });
      this.setData({ isTrashHover: false });
      this.isDragging = false;
      this.draggingIndex = -1;
      return;
    }

    // 2. 吸附
    if (this.isDragging && this.draggingIndex !== -1) {
      const bead = this.data.addedBeads[this.draggingIndex];
      const centerX = this.canvasWidth / 2;
      const centerY = this.canvasHeight / 2;

      let dropAngle = Math.atan2(bead.y - centerY, bead.x - centerX);
      
      // 强力找空位
      let bestAngle = this.findNearestEmptySlot(dropAngle, this.draggingIndex);

      if (bestAngle !== null) {
        this.data.addedBeads[this.draggingIndex].angle = bestAngle;
      } else {
        // 全满了，弹回原位
        this.data.addedBeads[this.draggingIndex].angle = this.originalAngleBeforeDrag;
      }
    }

    this.isDragging = false;
    this.draggingIndex = -1;
    this.render();
    this.setData({ addedBeads: this.data.addedBeads });
  },

  onTrashTap() {
    if (this.data.showClearConfirm) {
      this.setData({ addedBeads: [], totalPrice: '0.00', showClearConfirm: false });
      this.render();
      wx.showToast({ title: '已清空', icon: 'none' });
    } else {
      this.setData({ showClearConfirm: true });
      setTimeout(() => { if (this.data.showClearConfirm) this.setData({ showClearConfirm: false }); }, 3000);
    }
  },

  render() {
    if (!this.ctx) return;
    const { ctx, canvasWidth, canvasHeight } = this;
    const beads = this.data.addedBeads;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const braceletRadius = 120;
    const beadRadius = 18;

    ctx.beginPath();
    ctx.arc(centerX, centerY, braceletRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 1;
    ctx.stroke();

    beads.forEach((bead, index) => {
      let x = bead.x;
      let y = bead.y;

      if (index !== this.draggingIndex) {
        const angle = bead.angle;
        x = centerX + braceletRadius * Math.cos(angle);
        y = centerY + braceletRadius * Math.sin(angle);
        bead.x = x; 
        bead.y = y;
      }

      const gradient = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, beadRadius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, bead.color);
      gradient.addColorStop(1, bead.color);

      ctx.beginPath();
      ctx.arc(x, y, beadRadius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
});