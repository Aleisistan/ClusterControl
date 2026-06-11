"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = void 0;
var typeorm_1 = require("typeorm");
var Telemetry = function () {
    var _classDecorators = [(0, typeorm_1.Entity)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _temperature_decorators;
    var _temperature_initializers = [];
    var _temperature_extraInitializers = [];
    var _humidity_decorators;
    var _humidity_initializers = [];
    var _humidity_extraInitializers = [];
    var _extractor_decorators;
    var _extractor_initializers = [];
    var _extractor_extraInitializers = [];
    var _aire_decorators;
    var _aire_initializers = [];
    var _aire_extraInitializers = [];
    var _puerta_decorators;
    var _puerta_initializers = [];
    var _puerta_extraInitializers = [];
    var _created_at_decorators;
    var _created_at_initializers = [];
    var _created_at_extraInitializers = [];
    var Telemetry = _classThis = /** @class */ (function () {
        function Telemetry_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.temperature = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _temperature_initializers, void 0));
            this.humidity = (__runInitializers(this, _temperature_extraInitializers), __runInitializers(this, _humidity_initializers, void 0));
            this.extractor = (__runInitializers(this, _humidity_extraInitializers), __runInitializers(this, _extractor_initializers, void 0));
            this.aire = (__runInitializers(this, _extractor_extraInitializers), __runInitializers(this, _aire_initializers, void 0));
            this.puerta = (__runInitializers(this, _aire_extraInitializers), __runInitializers(this, _puerta_initializers, void 0));
            this.created_at = (__runInitializers(this, _puerta_extraInitializers), __runInitializers(this, _created_at_initializers, void 0));
            __runInitializers(this, _created_at_extraInitializers);
        }
        return Telemetry_1;
    }());
    __setFunctionName(_classThis, "Telemetry");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _temperature_decorators = [(0, typeorm_1.Column)('float')];
        _humidity_decorators = [(0, typeorm_1.Column)('float')];
        _extractor_decorators = [(0, typeorm_1.Column)()];
        _aire_decorators = [(0, typeorm_1.Column)()];
        _puerta_decorators = [(0, typeorm_1.Column)()];
        _created_at_decorators = [(0, typeorm_1.CreateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _temperature_decorators, { kind: "field", name: "temperature", static: false, private: false, access: { has: function (obj) { return "temperature" in obj; }, get: function (obj) { return obj.temperature; }, set: function (obj, value) { obj.temperature = value; } }, metadata: _metadata }, _temperature_initializers, _temperature_extraInitializers);
        __esDecorate(null, null, _humidity_decorators, { kind: "field", name: "humidity", static: false, private: false, access: { has: function (obj) { return "humidity" in obj; }, get: function (obj) { return obj.humidity; }, set: function (obj, value) { obj.humidity = value; } }, metadata: _metadata }, _humidity_initializers, _humidity_extraInitializers);
        __esDecorate(null, null, _extractor_decorators, { kind: "field", name: "extractor", static: false, private: false, access: { has: function (obj) { return "extractor" in obj; }, get: function (obj) { return obj.extractor; }, set: function (obj, value) { obj.extractor = value; } }, metadata: _metadata }, _extractor_initializers, _extractor_extraInitializers);
        __esDecorate(null, null, _aire_decorators, { kind: "field", name: "aire", static: false, private: false, access: { has: function (obj) { return "aire" in obj; }, get: function (obj) { return obj.aire; }, set: function (obj, value) { obj.aire = value; } }, metadata: _metadata }, _aire_initializers, _aire_extraInitializers);
        __esDecorate(null, null, _puerta_decorators, { kind: "field", name: "puerta", static: false, private: false, access: { has: function (obj) { return "puerta" in obj; }, get: function (obj) { return obj.puerta; }, set: function (obj, value) { obj.puerta = value; } }, metadata: _metadata }, _puerta_initializers, _puerta_extraInitializers);
        __esDecorate(null, null, _created_at_decorators, { kind: "field", name: "created_at", static: false, private: false, access: { has: function (obj) { return "created_at" in obj; }, get: function (obj) { return obj.created_at; }, set: function (obj, value) { obj.created_at = value; } }, metadata: _metadata }, _created_at_initializers, _created_at_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Telemetry = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Telemetry = _classThis;
}();
exports.Telemetry = Telemetry;
