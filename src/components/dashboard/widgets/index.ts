import type { ComponentType } from "react";
import GammaRegimeWidget from "./GammaRegimeWidget";
import KeyLevelsWidget from "./KeyLevelsWidget";
import ExposureFlowWidget from "./ExposureFlowWidget";
import ExpectedMoveWidget from "./ExpectedMoveWidget";
import DailyRangeWidget from "./DailyRangeWidget";
import TapeContextWidget from "./TapeContextWidget";
import VannaChartWidget from "./VannaChartWidget";
import CharmChartWidget from "./CharmChartWidget";
import StructureConcentrationWidget from "./StructureConcentrationWidget";
import IvRvSpreadWidget from "./IvRvSpreadWidget";

export const WIDGET_COMPONENTS: Record<string, ComponentType> = {
  "gamma-regime": GammaRegimeWidget,
  "key-levels": KeyLevelsWidget,
  "exposure-flow": ExposureFlowWidget,
  "expected-move": ExpectedMoveWidget,
  "daily-range": DailyRangeWidget,
  "tape-context": TapeContextWidget,
  "vanna-chart": VannaChartWidget,
  "charm-chart": CharmChartWidget,
  "structure-concentration": StructureConcentrationWidget,
  "iv-rv-spread": IvRvSpreadWidget,
};
