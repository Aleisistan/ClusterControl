"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
var http_1 = require("@angular/common/http");
var core_1 = require("@angular/core");
var router_1 = require("@angular/router");
var ng2_charts_1 = require("ng2-charts");
var platform_browser_1 = require("@angular/platform-browser");
var app_routes_1 = require("./app.routes");
exports.appConfig = {
    providers: [
        (0, core_1.provideZoneChangeDetection)({ eventCoalescing: true }),
        (0, router_1.provideRouter)(app_routes_1.routes),
        (0, http_1.provideHttpClient)(),
        (0, ng2_charts_1.provideCharts)((0, ng2_charts_1.withDefaultRegisterables)()),
        (0, platform_browser_1.provideClientHydration)((0, platform_browser_1.withEventReplay)())
    ]
};
