import { ArrowRightIcon } from "@heroicons/react/16/solid";
import { type MouseEventHandler, type PropsWithChildren, useEffect, useState } from "react";
import { Outlet, NavLink, type NavLinkProps } from "react-router";
import { ThemeSelector } from "~/components/ThemeSelector";
import SidebarIcon from "~/components/SidebarIcon"
import { Button } from "~/components/home/Button";
import { useMobile } from "~/hooks";

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

    const handleMenuItemClick: MouseEventHandler<HTMLElement> = (e) => { e.target !== e.currentTarget && mobile && setOpen(false) }

    return <div className="dark:text-white w-full flex">
        <nav className={`${!open ? "w-0 p-0 m-0" : `w-[180px] p-4`} fixed md:sticky print:hidden z-100 transition-all bg-gray-100 dark:bg-gray-800 py-4 shadow-md h-screen top-0 flex flex-col justify-between overflow-hidden`}
        >
            <menu className="space-y-2 relative" onClick={handleMenuItemClick}>
                <StyledLink to="/">Invoice</StyledLink>
                <StyledLink to="/clients">Clients</StyledLink>
                <StyledLink to="/invoices">Invoices</StyledLink>
            </menu>
            <ThemeSelector />
        </nav>
        {open &&
            <span className="bg-black/50 md:hidden inset-0 absolute z-99" onClick={() => setOpen(false)} />
        }
        <Button icon size="sm" className={`print:collapse fixed left-2 top-4 bg-transparent z-100 ${open ? "translate-x-[180px]" : "translate-x-0"}`} onClick={() => setOpen(o => !o)}>
            <SidebarIcon size={20} />
        </Button>
        <main className={`w-full flex-1 min-h-screen`}>
            <Outlet />
        </main>
    </div>
}