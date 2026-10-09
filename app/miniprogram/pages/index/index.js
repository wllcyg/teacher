Page({
  data: {
    greeting: '上午好，',
    userName: '读者',
    recentBooks: [
      {
        id: 1,
        title: '史记 (本纪)',
        author: '司马迁',
        progress: '已读 12%',
        coverColor: '#E8DFCE',
        tag: '史部'
      },
      {
        id: 2,
        title: '人类简史',
        author: '尤瓦尔·赫拉利',
        progress: '未开始',
        coverColor: '#DCE4E8',
        tag: '社科'
      },
      {
        id: 3,
        title: '边城',
        author: '沈从文',
        progress: '已读 89%',
        coverColor: '#E8DFCE',
        tag: '小说'
      }
    ]
  },
  onLoad() {
    // 根据时间设置问候语
    const hour = new Date().getHours();
    let greeting = '上午好，';
    if (hour >= 12 && hour < 18) greeting = '下午好，';
    else if (hour >= 18 || hour < 5) greeting = '晚上好，';
    
    this.setData({ greeting });
  },
  onBookTap(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '即将阅读 ' + bookId,
      icon: 'none'
    });
  }
})
