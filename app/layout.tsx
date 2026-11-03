import './course-graph.css';
import type { Metadata } from "next";
import "./globals.css";
import "./dark-theme.css";
import "./portal.css";
import "./pathways.css";

export const metadata: Metadata = {
  title: "CoursePlan — 课程路径工作区",
  description: "基于 UTS 官方历史课程快照的本地课程规划、先修关系与学期安排。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>

    </html>
  );
}
