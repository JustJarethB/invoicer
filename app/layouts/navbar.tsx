import { ArrowRightIcon } from "@heroicons/react/16/solid";
import { type PropsWithChildren, useEffect, useState } from "react";
import { Outlet, NavLink, type NavLinkProps } from "react-router";
import { ThemeSelector } from "~/components/ThemeSelector";
import SidebarIcon from "~/components/SidebarIcon"
import { Button } from "~/components/home/Button";

const MOBILE_BREAKPOINT = 768;

export function useMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}

const StyledLink = (props: PropsWithChildren<Omit<NavLinkProps, 'children'>>) => {
    return (
        <NavLink
            {...props}
            className={({ isActive }) =>
                `transition-colors block px-4 py-2 text-sm rounded ${isActive ? 'dark:bg-gray-600 bg-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500 font-bold' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`
            }
        >
            {({ isActive }) => (
                <div className="flex justify-between items-center">
                    {props.children}{isActive && <ArrowRightIcon className="h-5 -mr-2" strokeWidth={2} />}
                </ div>
            )}
        </NavLink>
    );
}

export default function Navbar() {
    const mobile = useMobile();
    const [open, setOpen] = useState(!mobile);

    useEffect(() => {
        setOpen(!mobile);
    }, [mobile]);

    return <div className="dark:text-white w-full flex">
        <nav className={`${!open ? "w-0 p-0 m-0" : `w-[180px] p-4`} ${mobile ? 'fixed' : 'sticky'} print:collapse z-100 transition-all bg-gray-100 dark:bg-gray-800 py-4 shadow-md h-screen top-0 flex flex-col justify-between overflow-hidden`}
        >
            <menu className="space-y-2 relative">
                <StyledLink to="/" onClick={() => mobile && setOpen(false)}>Invoice</StyledLink>
                <StyledLink to="/clients" onClick={() => mobile && setOpen(false)}>Clients</StyledLink>
                <StyledLink to="/invoices" onClick={() => mobile && setOpen(false)}>Invoices</StyledLink>
            </menu>
            <ThemeSelector />
        </nav>
        <Button icon size="sm" className={`print:collapse fixed left-4 top-4 bg-transparent z-100 ${open ? "translate-x-[180px]" : "translate-x-0"}`} onClick={() => setOpen(o => !o)}>
            <SidebarIcon size={20} />
        </Button>
        <main className={`print:col-span-full w-full flex-auto min-h-screen ${(mobile && open) ? 'opacity-50' : ''}`} onClick={() => mobile && setOpen(false)}>
            <Outlet/>
        </main>
    </div>
}