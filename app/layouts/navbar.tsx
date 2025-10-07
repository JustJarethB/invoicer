import { ArrowRightIcon } from "@heroicons/react/16/solid";
import { type PropsWithChildren, useState } from "react";
import { Outlet, NavLink, type NavLinkProps } from "react-router";
import { ThemeSelector } from "~/components/ThemeSelector";
import SidebarIcon from "~/components/SidebarIcon"
import { Button } from "~/components/home/Button";

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
    const WIDTH = 180;
    const [open, setOpen] = useState(true);
    return <div className="dark:text-white w-full flex">
        <nav className={`print:collapse transition-all ${!open ? "w-0 p-0 m-0" : `w-[${WIDTH}px] p-4`} bg-gray-100 dark:bg-gray-800 py-4 shadow-md h-screen sticky top-0 flex flex-col justify-between overflow-hidden`}>
            <menu className="space-y-2 relative">
                <StyledLink to="/">Invoice</StyledLink>
                <StyledLink to="/clients">Clients</StyledLink>
                <StyledLink to="/invoices">Invoices</StyledLink>
            </menu>
            <ThemeSelector />
        </nav>
        <Button icon size="sm" className={`absolute left-4 top-4 bg-transparent z-100 ${open ? "translate-x-[180px]" : "translate-x-0"}`} onClick={() => setOpen(o => !o)}>
            <SidebarIcon size={20} />
        </Button>
        <main className={`print:col-span-full flex-auto`}>
            <Outlet/>
        </main>
    </div>
}