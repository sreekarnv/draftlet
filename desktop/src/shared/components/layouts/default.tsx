import { Fragment } from "react";
import { Link, Outlet, useLocation } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { draftletNavigation, type DraftletNavItem } from "@/lib/navigation";

type Crumb = {
  label: string;
  href?: string;
};

function getActiveNavItem(pathname: string): DraftletNavItem {
  return (
    draftletNavigation.find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ??
    draftletNavigation.find((item) => item.path === pathname) ??
    draftletNavigation[0]
  );
}

function humanizeSegment(segment: string) {
  if (!segment) {
    return "";
  }
  const spaced = segment.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function getBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];

  if (segments.length === 0) {
    return [{ label: "Home" }];
  }

  let currentPath = "";
  let matchedNavItem: DraftletNavItem | undefined;
  let navConsumed = 0;

  for (let i = 0; i < segments.length; i += 1) {
    currentPath += `/${segments[i]}`;
    const navItem = draftletNavigation.find((item) => item.path === currentPath);
    if (navItem) {
      matchedNavItem = navItem;
      navConsumed = i + 1;
    }
  }

  if (matchedNavItem && matchedNavItem.path !== "/") {
    crumbs.push({
      label: matchedNavItem.title,
      ...(navConsumed < segments.length ? { href: matchedNavItem.path } : {}),
    });
  }

  const remainingSegments = segments.slice(navConsumed);
  for (let i = 0; i < remainingSegments.length; i += 1) {
    const isLast = i === remainingSegments.length - 1;
    const fullPath = `/${segments.slice(0, navConsumed + i + 1).join("/")}`;

    if (isLast) {
      crumbs.push({ label: humanizeSegment(remainingSegments[i]) });
    } else {
      crumbs.push({ label: humanizeSegment(remainingSegments[i]), href: fullPath });
    }
  }

  if (crumbs.length > 1 && !crumbs[crumbs.length - 1].href) {
    return crumbs;
  }

  const last = crumbs[crumbs.length - 1];
  if (last && last.href) {
    crumbs[crumbs.length - 1] = { label: last.label };
  }

  return crumbs;
}

export const DefaultLayout = () => {
  const location = useLocation();
  const activeItem = getActiveNavItem(location.pathname);
  const crumbs = getBreadcrumbs(location.pathname);
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <AppSidebar activePath={location.pathname} />
        <SidebarInset className="bg-background h-full min-h-0 min-w-0 overflow-hidden shadow-none md:m-0 md:rounded-none">
          <header className="border-sidebar-border/55 bg-background/95 flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger className="md:hidden" />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="min-w-0 truncate">
                {crumbs.map((crumb, index) => {
                  const isLast = index === crumbs.length - 1;

                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem className="min-w-0">
                        {isLast || !crumb.href ? (
                          <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild className="truncate">
                            <Link to={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="hidden min-w-0 items-center gap-3 xl:flex">
              <span aria-hidden className="bg-sidebar-border/55 h-4 w-px shrink-0" />
              <span className="text-muted-foreground truncate text-sm">
                {activeItem.description}
              </span>
            </div>

            <h1 className="sr-only">{crumbs[crumbs.length - 1]?.label ?? activeItem.title}</h1>
          </header>
          <main className="bg-background h-full min-h-0 flex-1 overflow-hidden">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};
