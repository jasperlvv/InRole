import Link from "next/link";
import { siteInfo } from "@/lib/site-info";
export const metadata = { title: "账号注销 · InRole" };
export default function DeleteAccount() { return <main className="policy-page"><Link href="/">返回社区</Link><h1>注销InRole账号</h1><p>登录后进入“账号设置 → 隐私与账号”，核对影响，输入当前密码及“注销我的账号”即可申请永久注销。此操作不可撤销；全部设备会退出，个人公开内容及私人媒体将移除。</p><p>已结算通宝的最小去标识账目、防冒用ID摘要及备份处理见<Link href="/privacy">隐私政策</Link>。请先保存你需要的内容。</p><Link className="button button-danger" href="/live/account-controls">前往注销与屏蔽管理</Link><p>无法登录可先<Link href="/live/recover">使用恢复码</Link>；需要人工协助请联系<a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a>。没有恢复凭据时需核验身份，不能保证直接认领账号。</p></main>; }
