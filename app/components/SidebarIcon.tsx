const SidebarIcon = ({ className, size }: { className?: string, size?: number }) => {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size ? size : "24"} height={size ? size : "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-panel-right-icon lucide-panel-right rotate-180 ${className}`}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
}

export default SidebarIcon;