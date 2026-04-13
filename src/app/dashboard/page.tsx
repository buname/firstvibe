"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DashboardErrorBoundary from "@/components/dashboard/DashboardErrorBoundary";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import ExposuresTab from "@/components/dashboard/tabs/ExposuresTab";
import HeatmapTab from "@/components/dashboard/tabs/HeatmapTab";
import LevelsTab from "@/components/dashboard/tabs/LevelsTab";
import StrikeTableTab from "@/components/dashboard/tabs/StrikeTableTab";
import FlowTab from "@/components/dashboard/tabs/FlowTab";
import SurfaceTab from "@/components/dashboard/tabs/SurfaceTab";
import ReplayTab from "@/components/dashboard/tabs/ReplayTab";
import CompareTab from "@/components/dashboard/tabs/CompareTab";
import CalendarTab from "@/components/dashboard/tabs/CalendarTab";
import JournalTab from "@/components/dashboard/tabs/JournalTab";
import JournalDndProvider from "@/components/journal/JournalDndProvider";
import TerminalTab from "@/components/dashboard/tabs/TerminalTab";
import SettingsTab from "@/components/dashboard/tabs/SettingsTab";
import BiasTab from "@/components/dashboard/tabs/BiasTab";
import GexScanTab from "@/components/dashboard/tabs/GexScanTab";
import LegacyBundleTab from "@/components/dashboard/tabs/LegacyBundleTab";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import { useLevelCrossAlerts } from "@/hooks/useLevelCrossAlerts";
import { useMarketData } from "@/hooks/useMarketData";
import type { TabId, TickerSymbol } from "@/lib/constants";

function DashboardSkeleton() {
  return (
    <div className="flex-1 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded border border-[#1a1a1a] bg-[#0b0b0b]"
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [symbol, setSymbol] = useState<TickerSymbol>("SPY");
  const [activeTab, setActiveTab] = useState<TabId>("exposures");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshMs, setRefreshMs] = useState(60_000);

  const { data, refresh, selectedExpiry, setSelectedExpiry } = useMarketData(
    symbol,
    refreshMs
  );

  useLevelCrossAlerts({
    symbol,
    spotPrice: data?.spotPrice ?? 0,
    keyLevels: data?.keyLevels ?? null,
    refreshToken: data?.lastUpdate?.getTime() ?? null,
  });

  const renderTab = () => {
    if (!data) {
      if (activeTab === "gexscan") return <GexScanTab />;
      if (activeTab === "journal") {
        return (
          <JournalDndProvider>
            <JournalTab />
          </JournalDndProvider>
        );
      }
      if (activeTab === "settings") {
        return (
          <SettingsTab
            refreshMs={refreshMs}
            onRefreshMsChange={setRefreshMs}
          />
        );
      }
      if (activeTab === "legacy") {
        return <LegacyBundleTab />;
      }
      if (activeTab === "compare") {
        return (
          <CompareTab
            primarySymbol={symbol}
            onOpenInTerminal={(s) => {
              setSymbol(s);
              setActiveTab("terminal");
            }}
          />
        );
      }
      return (
        <DashboardSkeleton />
      );
    }

    switch (activeTab) {
      case "exposures":
        return (
          <ExposuresTab
            gexByStrike={data.gexByStrike}
            keyLevels={data.keyLevels}
            spotPrice={data.spotPrice}
            chain={data.chain}
          />
        );
      case "bias":
        return (
          <BiasTab
            symbol={symbol}
            spotPrice={data.spotPrice}
            keyLevels={data.keyLevels}
            flowRatio={data.flowRatio}
            netFlow={data.netFlow}
            atmIvPct={data.atmIvPct}
            totalNetGex={data.totalNetGex}
            live={data.live}
            vix={data.vix}
            vixChangePct={data.vixChangePct}
          />
        );
      case "heatmap":
        return (
          <HeatmapTab
            key={symbol}
            symbol={symbol}
            heatmap={data.heatmap}
            spotPrice={data.spotPrice}
          />
        );
      case "levels":
        return <LevelsTab keyLevels={data.keyLevels} atmIvPct={data.atmIvPct} />;
      case "strikes":
        return (
          <StrikeTableTab chain={data.chain} spotPrice={data.spotPrice} />
        );
      case "flow":
        return (
          <FlowTab flow={data.unusualFlow} spotPrice={data.spotPrice} />
        );
      case "surface":
        return (
          <SurfaceTab chain={data.chain} spotPrice={data.spotPrice} />
        );
      case "legacy":
        return <LegacyBundleTab />;
      case "replay":
        return (
          <ReplayTab
            gexByStrike={data.gexByStrike}
            spotPrice={data.spotPrice}
          />
        );
      case "compare":
        return (
          <CompareTab
            primarySymbol={symbol}
            onOpenInTerminal={(s) => {
              setSymbol(s);
              setActiveTab("terminal");
            }}
          />
        );
      case "calendar":
        return <CalendarTab chain={data.chain} />;
      case "journal":
        return (
          <JournalDndProvider>
            <JournalTab />
          </JournalDndProvider>
        );
      case "terminal":
        return (
          <TerminalTab
            keyLevels={data.keyLevels}
            symbol={symbol}
            displaySpot={data.displaySpot}
            spotPrice={data.spotPrice}
            flowRatio={data.flowRatio}
            netFlow={data.netFlow}
            totalNetGex={data.totalNetGex}
            atmIvPct={data.atmIvPct}
            change={data.change}
            changePct={data.changePct}
            live={data.live}
            chain={data.chain}
            lastUpdate={data.lastUpdate}
          />
        );
      case "gexscan":
        return <GexScanTab />;
      case "settings":
        return (
          <SettingsTab
            refreshMs={refreshMs}
            onRefreshMsChange={setRefreshMs}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      <Header
        symbol={symbol}
        onSymbolChange={setSymbol}
        spotPrice={data?.displaySpot ?? data?.spotPrice ?? 0}
        change={data?.change ?? 0}
        changePct={data?.changePct ?? 0}
        lastUpdate={data?.lastUpdate ?? null}
        onRefresh={refresh}
        collapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        live={data?.live}
        isMarketOpen={data?.isMarketOpen}
        expiries={data?.expiries ?? []}
        selectedExpiry={selectedExpiry}
        onExpiryChange={setSelectedExpiry}
        news={data?.news ?? []}
        refreshMs={refreshMs}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <DashboardErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${activeTab}-${symbol}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  {renderTab()}
                </motion.div>
              </AnimatePresence>
            </DashboardErrorBoundary>
          </div>
        </main>
      </div>
      {data && (
        <DashboardFooter
          symbol={symbol}
          spotPrice={data.displaySpot}
          netGexBillions={data.totalNetGex}
          atmIvPct={data.atmIvPct}
          keyLevels={data.keyLevels}
          flowRatio={data.flowRatio}
        />
      )}
    </div>
  );
}
