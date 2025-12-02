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

  // --- 全局参数 ---
  // [关键] 稍微调大一点间隔，防止视觉上的边缘重叠
  BEAD_GAP_RAD: 0.36, 
  
  canvasNode: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  canvasLeft: 0,
  canvasTop: 0,
  
  isDragging: false,
  draggingIndex: -1,
  originalAngleBeforeDrag: 0, // [新增] 记录拖拽前的角度，用于回弹

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
        const dpr = wx.getSystemInfoSync().pixelRatio;

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

  // --- 1. 智能添加 ---
  onSelectBead(e) {
    const bead = e.currentTarget.dataset.item;
    // 默认从正上方(-PI/2)开始找
    const startAngle = -Math.PI / 2;
    
    // 使用新的查找算法寻找空位
    const foundAngle = this.findNearestEmptySlot(startAngle, -1);

    if (foundAngle === null) {
      wx.showToast({ title: '没有空间啦', icon: 'none' });
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

  // --- 2. [核心工具] 角度归一化 ---
  // 把任何角度转换到 -PI ~ PI 之间，确保比较时不出错
  normalizeAngle(angle) {
    let res = angle;
    while (res <= -Math.PI) res += 2 * Math.PI;
    while (res > Math.PI) res -= 2 * Math.PI;
    return res;
  },

  // --- 3. [核心算法] 严格的碰撞检测 ---
  checkCollision(targetAngle, excludeIndex) {
    const beads = this.data.addedBeads;
    const normTarget = this.normalizeAngle(targetAngle);

    for (let i = 0; i < beads.length; i++) {
      if (i === excludeIndex) continue;
      
      const normBead = this.normalizeAngle(beads[i].angle);
      
      // 计算圆周上的最短距离
      let diff = Math.abs(normTarget - normBead);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      
      // 如果距离小于间隔，判定为碰撞
      if (diff < this.BEAD_GAP_RAD * 0.95) return true; // 0.95做一点点容错
    }
    return false;
  },

  // --- 4. [核心算法] 寻找最近的合法空位 ---
  // 以前是盲目搜索，现在是“候选点评估法”
  findNearestEmptySlot(targetAngle, myIndex) {
    // A. 如果目标位置本身就是空的，直接返回
    if (!this.checkCollision(targetAngle, myIndex)) {
      return targetAngle;
    }

    const beads = this.data.addedBeads;
    const candidates = []; // 候选位置列表

    // B. 收集所有可能的缝隙
    // 对于每一颗现有的珠子，它的“左边紧贴处”和“右边紧贴处”都是潜在的候选位
    beads.forEach((b, idx) => {
      if (idx === myIndex) return;
      candidates.push(b.angle + this.BEAD_GAP_RAD); // 右邻居
      candidates.push(b.angle - this.BEAD_GAP_RAD); // 左邻居
    });

    // C. 筛选出不碰撞的候选位
    const validCandidates = candidates.filter(ang => !this.checkCollision(ang, myIndex));

    if (validCandidates.length === 0) return null; // 真的没地儿了

    // D. 找出离 targetAngle 最近的那个
    let bestAngle = null;
    let minDiff = Infinity;

    validCandidates.forEach(cand => {
      let diff = Math.abs(this.normalizeAngle(cand) - this.normalizeAngle(targetAngle));
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      if (diff < minDiff) {
        minDiff = diff;
        bestAngle = cand;
      }
    });

    return bestAngle;
  },

  // --- 辅助函数 ---
  updateDataAndRender(newBeads) {
    const total = newBeads.reduce((sum, item) => sum + item.price, 0);
    this.setData({
      addedBeads: newBeads,
      totalPrice: total.toFixed(2)
    }, () => {
      this.render();
    });
  },

  // --- 触摸交互 ---

  onTouchStart(e) {
    if (e.touches.length > 1) return;
    const { x, y } = e.touches[0];
    const touchX = x - this.canvasLeft;
    const touchY = y - this.canvasTop;

    const beads = this.data.addedBeads;
    for (let i = beads.length - 1; i >= 0; i--) {
      const dx = touchX - beads[i].x;
      const dy = touchY - beads[i].y;
      if (dx * dx + dy * dy < 30 * 30) {
        this.isDragging = true;
        this.draggingIndex = i;
        // [新增] 记录起飞前的位置，如果没地儿放就弹回来
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

    // 垃圾桶逻辑
    const distToRight = this.canvasWidth - touchX;
    const distToBottom = this.canvasHeight - touchY;
    if (distToRight < 80 && distToBottom < 80) {
      if (!this.data.isTrashHover) this.setData({ isTrashHover: true });
    } else {
      if (this.data.isTrashHover) this.setData({ isTrashHover: false });
    }

    // 珠子跟随手指
    const targetBead = this.data.addedBeads[this.draggingIndex];
    targetBead.x = touchX;
    targetBead.y = touchY;

    this.render();
  },

  onTouchEnd() {
    // 1. 垃圾桶删除
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

    // 2. 松手逻辑
    if (this.isDragging && this.draggingIndex !== -1) {
      const bead = this.data.addedBeads[this.draggingIndex];
      const centerX = this.canvasWidth / 2;
      const centerY = this.canvasHeight / 2;

      // 算出落点的理想角度
      let dropAngle = Math.atan2(bead.y - centerY, bead.x - centerX);
      
      // [核心修复] 使用新的找空位算法
      let bestAngle = this.findNearestEmptySlot(dropAngle, this.draggingIndex);

      if (bestAngle !== null) {
        // 找到了空位，吸附过去
        this.data.addedBeads[this.draggingIndex].angle = bestAngle;
      } else {
        // 没地儿放（比如手链满了还硬挤），弹回起飞点
        this.data.addedBeads[this.draggingIndex].angle = this.originalAngleBeforeDrag;
        wx.showToast({ title: '这里放不下啦', icon: 'none' });
      }
    }

    this.isDragging = false;
    this.draggingIndex = -1;
    this.render(); // 强制归位
    this.setData({ addedBeads: this.data.addedBeads });
  },

  onTrashTap() {
    if (this.data.showClearConfirm) {
      this.setData({ addedBeads: [], totalPrice: '0.00', showClearConfirm: false });
      this.render();
      wx.showToast({ title: '已清空', icon: 'none' });
    } else {
      this.setData({ showClearConfirm: true });
      setTimeout(() => {
        if (this.data.showClearConfirm) this.setData({ showClearConfirm: false });
      }, 3000);
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

      // 非拖拽状态：强制固定在圆周上
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