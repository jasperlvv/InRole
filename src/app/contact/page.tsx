import Link from "next/link";
import { siteInfo } from "@/lib/site-info";
export const metadata = { title: "联系与举报 · InRole" };
export default function Contact() { return <main className="policy-page"><Link href="/">返回社区</Link><h1>联系、举报与申诉</h1><p>运营者：{siteInfo.operator}</p><p>公开邮箱：<a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a></p><p>帖子、评论和评价可直接使用站内举报入口。侵权、隐私、安全问题、账号删除协助或处理申诉，也可发邮件。</p><p>请提供问题链接、发生时间、必要说明及页面反馈编号。权利投诉请提供合理的权利与身份依据。不要发送密码、恢复码或无关的敏感证件信息。邮件由运营者人工处理，不代表已自动执行删除或解除封禁。</p><Link className="button button-outline" href="/delete-account">账号注销说明</Link></main>; }
