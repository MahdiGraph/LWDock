import { LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Sign-in and setup screens: the name at display size, the form beside it,
 * and a row of real interface fragments showing what the panel does.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-background p-2 md:p-3">
      <div className="grid min-h-[calc(100svh-1rem)] grid-cols-12 gap-2 md:min-h-[calc(100svh-1.5rem)] md:grid-rows-[1fr_auto]">
        <section className="order-2 col-span-12 flex flex-col justify-between gap-10 bg-card p-6 md:order-1 md:col-span-7 md:p-10">
          <div className="flex items-center justify-between">
            <LogoMark />
            <ThemeToggle />
          </div>
          <div>
            <h1 className="display text-[13vw] uppercase md:text-[6.4vw]">
              Leaseweb
              <br />
              Dock
            </h1>
            <p className="prose-serif mt-6 max-w-xl text-lg md:text-xl">
              Hand each friend their own Leaseweb servers. They reboot, reinstall and rescue on their own, and your
              account stays yours.
            </p>
          </div>
        </section>

        <section className="order-1 col-span-12 flex flex-col justify-center bg-tile p-6 md:order-2 md:col-span-5 md:p-10">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>

        <div className="order-3 col-span-12 grid grid-cols-12 gap-2" data-ui aria-hidden>
          <div className="col-span-12 bg-primary p-5 text-primary-foreground sm:col-span-6 md:col-span-4">
            <p className="text-[13px] opacity-80">AMS-01 · rack 14 · unit 22</p>
            <p className="display mt-3 text-4xl">Powered on</p>
            <p className="mt-3 text-sm opacity-80">Rebooted 34 s ago by alex</p>
          </div>
          <div className="col-span-12 flex flex-col justify-between bg-card p-5 sm:col-span-6 md:col-span-3">
            <p className="text-sm">Installing Ubuntu 24.04</p>
            <div className="mt-6">
              <div className="h-3 bg-muted">
                <div className="h-3 w-[64%] bg-foreground" />
              </div>
              <p className="display mt-3 text-3xl tabular">64%</p>
            </div>
          </div>
          <div className="col-span-6 flex flex-col justify-between bg-tile p-5 md:col-span-2">
            <p className="text-[13px] text-muted-foreground">Leaseweb API via</p>
            <p className="display mt-3 text-3xl">SOCKS5</p>
          </div>
          <div className="col-span-6 flex flex-col justify-between bg-card p-5 md:col-span-3">
            <p className="text-[13px] text-muted-foreground">Reverse DNS</p>
            <div className="mt-3">
              <p className="text-base">mail.example.net</p>
              <p className="text-sm text-muted-foreground tabular">203.0.113.24</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
