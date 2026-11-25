import Link from "next/link";
import { siteInfo } from "@/lib/site-info";
export function SiteFooter() {
  return <footer className="site-footer" aria-label="网站信息"><nav aria-label="政策与帮助"><Link href="/privacy">隐私政策</Link><Link href="/terms">用户协议</Link><Link href="/contact">联系与举报</Link><Link href="/delete-account">账号注销</Link></nav><p>InRole · {siteInfo.operator} · <a href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a></p></footer>;
}
