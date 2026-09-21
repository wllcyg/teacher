Page({
  data: {
    inputValue: '',
    lastMsgId: 'msg-1',
    messages: [
      {
        id: '1',
        sender: 'ai',
        text: '你好！我是你的 AI 财务助手。你可以把想测算的场景告诉我，比如工资、房贷利率、年终奖等，我能直接为你精准测算！',
        action: {
          title: '房贷测算器',
          sub: '支持最新 LPR 商业/公积金组合贷',
          icon: 'home',
          url: '/pages/result/result?type=mortgage'
        }
      }
    ]
  },

  onLoad() {},

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  usePrompt(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputValue: text }, () => {
      this.sendMessage();
    });
  },

  sendMessage() {
    const text = this.data.inputValue.trim();
    if (!text) return;

    const userMsg = {
      id: String(Date.now()),
      sender: 'user',
      text: text
    };

    const newMessages = [...this.data.messages, userMsg];
    this.setData({
      messages: newMessages,
      inputValue: '',
      lastMsgId: `msg-${userMsg.id}`
    });

    // 模拟 AI 智能意图识别与回复
    wx.showLoading({ title: '思考中...' });
    setTimeout(() => {
      wx.hideLoading();
      let replyText = '已为你解析财务测算需求，请查看下方推荐方案：';
      let action = {
        title: '薪资与五险一金测算',
        sub: '点击自动代入参数查看明细',
        icon: 'wallet',
        url: '/pages/result/result?type=salary'
      };

      if (text.includes('房贷') || text.includes('按揭') || text.includes('买房')) {
        replyText = '识别到【购房房贷】测算需求，已为你匹配2026年最新公积金与商业房贷算法：';
        action = {
          title: '房贷月供与利息测算',
          sub: '等额本息/等额本金全周期对比',
          icon: 'home',
          url: '/pages/result/result?type=mortgage'
        };
      } else if (text.includes('年终奖')) {
        replyText = '识别到【年终奖计税】问题，建议通过专项对比避开计税临界点：';
        action = {
          title: '年终奖避税对比工具',
          sub: '单独计税 vs 合并计税',
          icon: 'swap',
          url: '/pages/compare/compare'
        };
      }

      const aiMsg = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: replyText,
        action: action
      };

      this.setData({
        messages: [...this.data.messages, aiMsg],
        lastMsgId: `msg-${aiMsg.id}`
      });
    }, 600);
  },

  navigateToAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action && action.url) {
      wx.navigateTo({ url: action.url });
    }
  }
});
