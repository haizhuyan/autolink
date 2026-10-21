export type PlanId = "free" | "basic" | "pro" | "max";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  products: number;
  /** null 表示不限：每个产品可提交全部目录，含后续新增 */
  credits: number | null;
  summary: string;
  items: string[];
};

// 全部为一次性付款，额度永久有效（PRD 第 5 章）。
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    products: 1,
    credits: 1,
    summary: "体验一次完整流程",
    items: ["1 个产品", "1 次自动提交，目录自选", "人工接管与提交截图", "公开站点库"],
  },
  {
    id: "basic",
    name: "Basic",
    price: 19,
    products: 1,
    credits: 100,
    summary: "单个产品起步",
    items: ["1 个产品", "100 次目录提交", "自定义站点与历史导入", "备注与状态追踪"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    products: 3,
    credits: 300,
    summary: "多个产品并行",
    items: ["3 个产品", "300 次目录提交（产品间共享）", "产品 × 站点矩阵", "Basic 的全部功能"],
  },
  {
    id: "max",
    name: "Max",
    price: 99,
    products: 5,
    credits: null,
    summary: "全部目录，持续更新",
    items: ["5 个产品", "每个产品提交全部目录", "含后续新增目录", "Pro 的全部功能"],
  },
];

export function getPlan(id: PlanId) {
  return plans.find((p) => p.id === id)!;
}
