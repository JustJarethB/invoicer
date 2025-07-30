import type { ReactNode } from "react";

export const withProvider = (Provider: React.ComponentType<{ children: ReactNode; }>) => (Component: React.ComponentType<any>) => {
    return function WrappedComponent(props: any) {
        return (
            <Provider>
                <Component {...props} />
            </Provider>
        );
    };
}
