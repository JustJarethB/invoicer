import type { ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withProvider = (Provider: React.ComponentType<{ children: ReactNode; }>) => (Component: React.ComponentType<any>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function WrappedComponent(props: any) {
        return (
            <Provider>
                <Component {...props} />
            </Provider>
        );
    };
}
