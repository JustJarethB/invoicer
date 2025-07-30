import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    layout("layouts/navbar.tsx", [
        index("routes/invoice.tsx"),
        route("clients", "routes/clients.tsx"),
        route("invoices", "routes/invoices.tsx"),
    ]),
] satisfies RouteConfig;
