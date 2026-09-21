/**
 * miniprogram/utils/math.js
 * 金融级高精度数学工具库，解决 IEEE 754 浮点数丢失与分厘误差
 */
const Big = require('../miniprogram_npm/big.js/index.js');

/**
 * 精准加法: a + b
 */
function add(a, b) {
  return new Big(a || 0).plus(b || 0).toNumber();
}

/**
 * 精准减法: a - b
 */
function sub(a, b) {
  return new Big(a || 0).minus(b || 0).toNumber();
}

/**
 * 精准乘法: a * b
 */
function mul(a, b) {
  return new Big(a || 0).times(b || 0).toNumber();
}

/**
 * 精准除法: a / b
 */
function div(a, b, decimals) {
  if (Number(b) === 0) return 0;
  const res = new Big(a || 0).div(b);
  return typeof decimals === 'number' ? Number(res.toFixed(decimals)) : res.toNumber();
}

/**
 * 四舍五入保留小数位
 * @param {number|string} val
 * @param {number} decimals 默认2位
 */
function round(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Number(new Big(val).toFixed(decimals));
}

/**
 * 高性能幂运算: base ^ exp (采用硬件浮点加速，避免 Big.pow 大数展开造成的严重卡顿)
 */
function pow(base, exp) {
  return Math.pow(Number(base), Number(exp));
}

/**
 * 格式化为货币展示形态 (带千分位与2位小数): 如 1,234,567.89
 */
function formatMoney(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const fixed = new Big(num).toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

module.exports = {
  Big,
  add,
  sub,
  mul,
  div,
  round,
  pow,
  formatMoney
};
