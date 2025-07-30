import { ArrowRightIcon } from "@heroicons/react/16/solid";
import type { PropsWithChildren } from "react";
import { Outlet, NavLink, type NavLinkProps } from "react-router";

const StyledLink = (props: PropsWithChildren<Omit<NavLinkProps, 'children'>>) => {
    return (
        <NavLink
            {...props}
            className={({ isActive }) =>
                `block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isActive ? 'dark:bg-gray-600 bg-gray-300  font-bold' : ''}`
            }
        >
            {({ isActive }) => (
                <div className="flex justify-between items-center">
                    {props.children}{isActive && <ArrowRightIcon className="h-5 -mr-2" />}
                </ div>
            )}
        </NavLink>
    );
}

export default function Navbar() {
    return <div className="grid grid-cols-12">
        <nav className="print:collapse col-span-1 bg-gray-100 dark:bg-gray-800 p-4 shadow-md h-screen sticky top-0">
            <StyledLink to="/">Invoice</StyledLink>
            <StyledLink to="/clients">Clients</StyledLink>
            <StyledLink to="/invoices">Invoices</StyledLink>
        </nav>
        <main className="col-span-11 print:col-span-full">
            <Outlet />
        </main>
    </div>
}