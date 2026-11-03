import type {NextConfig} from 'next';
const pages=process.env.NEXT_PUBLIC_DEMO_MODE==='1';
const basePath=pages?(process.env.NEXT_PUBLIC_BASE_PATH||'/courseplan'):'';
const nextConfig:NextConfig={outputFileTracingRoot:process.cwd(),...(pages?{output:'export',basePath,trailingSlash:true,images:{unoptimized:true}}:{})};
export default nextConfig;
