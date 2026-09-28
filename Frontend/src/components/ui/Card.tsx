import { ElementType, ComponentPropsWithoutRef } from "react";

type CardProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

export function Card<T extends ElementType = "div">({ as, className, children, ...props }: CardProps<T>) {
  const Component = as ?? "div";
  return (
    <Component className={`bg-card border border-card-border rounded-xl ${className ?? ""}`} {...props}>
      {children}
    </Component>
  );
}
