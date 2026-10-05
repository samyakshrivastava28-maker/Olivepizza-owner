# Graph Report - olive-pizza-owner  (2026-10-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4168 nodes · 9807 edges · 201 communities (148 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d41544f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- config/firebase.ts
- fetchApi
- order.routes.ts
- react-hot-toast
- backend/package.json
- useAuthStore
- useDataStore
- app.ts
- delivery.routes.ts
- homePageManager.routes.ts
- postgres.ts
- backend/server.ts
- lucide-react
- WebsiteConfigService.ts
- aiImage.routes.ts
- dependencies
- privacy.routes.ts
- frontend/package.json
- src/App.tsx
- getPaymentConfig
- auth.middleware.ts
- dependencies
- frontend/src/App.tsx
- query
- user.routes.ts
- TruecallerProvider
- dependencies
- NotificationEngine.ts
- location.routes.ts
- Ads.tsx
- pos.routes.ts
- DeliveryAlarmManagerClass
- AppDelegate
- PushNotificationManager.tsx
- runner.ts
- emailTemplates.service.ts
- TextToSpeech.service.ts
- frontend/src/types/PageSchema.ts
- PaymentService.ts
- frontend/src/types/models.ts
- payment.routes.ts
- OrderStateMachine.ts
- AppEventBus.ts
- report.routes.ts
- InMemoryBillingRepository
- src/lib/firebase.ts
- franchise.routes.ts
- DeliveryLocationService.java
- MainActivity.java
- KnowledgeBaseService
- auth.routes.ts
- ref_path
- order_data_minimization.test.ts
- com.getcapacitor.PluginCall
- OwnerLiveMap.tsx
- Products.tsx
- OliveMessagingService.java
- AIContextBuilder.ts
- services/email.service.ts
- compilerOptions
- compilerOptions
- EmailService
- media.routes.ts
- motion.ts
- Ferrofluid.tsx
- ai.routes.ts
- .logEvent
- compilerOptions
- MainActivity
- devDependencies
- health.stream.routes.ts
- StaticKnowledgeLoader.ts
- LiveOrders.tsx
- ref_fs
- dataManager.routes.ts
- execute_complete_rebuild.ts
- migrate_google_sheets.ts
- versionManager.ts
- src/components/orders/EmergencyOrderModal.tsx
- security.config.ts
- riderDelivery.routes.ts
- OlivePizzaAISDK
- OliveWebSocketServer
- DeliveryMap.tsx
- AICacheService
- CanonicalOrderService.ts
- devops.routes.ts
- kitchen.routes.ts
- ai.service.ts
- DatabaseProviderRegistry.ts
- UniversalMap3D.tsx
- OlivePizzaAISDK.ts
- notification.service.ts
- FirestoreOrderRepository
- SheetsSyncWorker
- AIOperationsStore
- FranchiseScopeService
- googleDrive.service.ts
- SalesCalculationEngine
- OwnerLiveMapModal.tsx
- scheduling.ts
- GoogleSheetsReportService.ts
- StorageAnalyzerService
- inventory.routes.ts
- restaurantManager.routes.ts
- PaymentEventQueue.ts
- Truecaller.ts
- frontend/src/lib/imageOptimizer.ts
- scripts
- verify_owner_app.cjs
- ExampleInstrumentedTest.java
- TruecallerPlugin.java
- BillingNumberService
- github.routes.ts
- DeepSeekV4FlashGenerator.ts
- .logAction
- PaymentErrorHandler.ts
- firebase-messaging-sw.js
- frontend/src/main.tsx
- aiIntegration.routes.ts
- toolExecutor.ts
- DataLifecycleService
- FCMTokenCache
- FranchiseGoogleSheetsService
- DevUI.tsx
- ErrorBoundary.tsx
- platform.ts
- LegalPageLayout.tsx
- ui/SafeErrorBoundary.tsx
- payment.config.ts
- coupon.routes.ts
- OrderProjectionService
- devDependencies
- manifest.json
- FlagshipFooter.tsx
- CatalogGuard.ts
- .testProvider
- franchise-security.test.ts
- homeLayout.ts
- OlivePizzaAIClient
- brandLock.ts
- compilerOptions
- src/pages/HomePageManager.tsx
- compilerOptions
- NotificationActionReceiver
- ConversationMemoryAdapter
- CryptoService
- NotificationScheduler
- main.cjs
- useNotificationDebugger.ts
- AlarmPermissionPluginRegistry
- auditSupabaseUsage.cjs
- AIRoutingManagerService
- ErrorCenterService
- NotificationTemplateService
- scripts
- GlobalErrorBoundary
- errorTranslator.ts
- frontend/src/lib/utils.ts
- DeliveryPluginRegistry
- analyticsTracker.ts
- devDependencies
- scripts
- AIHealthMonitor
- languageDetector.ts
- DatabaseProviderRegistry
- security_scanner.ts
- capacitor.config.ts
- useLiveMetrics.ts
- SoundSynthesizer
- offlineSync.ts
- frontend/vercel.json
- vercel.json
- gradlew
- SchedulerManagerService
- NotificationDebugger
- MonthEndReportWorker
- AnimatedDashboardBackground.tsx
- ClickSpark.tsx
- frontend/src/types/sdui.ts
- src/main.tsx
- sanitizeForLog
- frontend/src/vite-env.d.ts
- src/vite-env.d.ts
- deploy-vps.sh
- Package.swift

## God Nodes (most connected - your core abstractions)
1. `react` - 206 edges
2. `lucide-react` - 157 edges
3. `adminDb` - 135 edges
4. `framer-motion` - 92 edges
5. `react-hot-toast` - 77 edges
6. `firebase` - 73 edges
7. `fetchApi()` - 70 edges
8. `useAuthStore` - 66 edges
9. `react-router` - 60 edges
10. `db` - 49 edges

## Surprising Connections (you probably didn't know these)
- `EmergencyOrderModalProps` --references--> `Order`  [EXTRACTED]
  src/components/orders/EmergencyOrderModal.tsx → src/types/models.ts
- `DashboardHome()` --calls--> `useAuthStore`  [EXTRACTED]
  frontend/src/components/customer/dashboard/DashboardHome.tsx → frontend/src/lib/store.ts
- `HomePageManager()` --calls--> `fetchApi()`  [EXTRACTED]
  src/pages/HomePageManager.tsx → src/lib/api.ts
- `AccountApprovals()` --calls--> `fetchApi()`  [EXTRACTED]
  src/pages/AccountApprovals.tsx → src/lib/api.ts
- `NotificationCenter()` --calls--> `fetchApi()`  [EXTRACTED]
  src/pages/NotificationCenter.tsx → src/lib/api.ts

## Import Cycles
- None detected.

## Communities (201 total, 53 thin omitted)

### Community 0 - "react"
Cohesion: 0.03
Nodes (50): DashboardHome(), Props, DeclineDeliveryReasonModalProps, PRESET_REASONS, reasonSchema, CravingCategoriesSection(), CravingCategory, CravingProductItem (+42 more)

### Community 1 - "config/firebase.ts"
Cohesion: 0.04
Nodes (37): adminAuth, adminDb, adminMessaging, FIREBASE_PRIVATE_KEY, AIHealthMetrics, orderRepository, CONFIRMED_TEST_PATTERNS, PROTECTED_EMAILS (+29 more)

### Community 2 - "fetchApi"
Cohesion: 0.04
Nodes (69): DeliveryManagement, EmailCenter, FranchiseManager, HomePageManager, MediaLibrary, PrivacyGovernance, ProductMenuManager, RestaurantControlPage (+61 more)

### Community 3 - "order.routes.ts"
Cohesion: 0.05
Nodes (42): calculateDistance(), deg2rad(), FirestoreListener, actionSchema, LockInfo, getLocalDateString(), getNextDailyOrderNumber(), queueEmail() (+34 more)

### Community 4 - "react-hot-toast"
Cohesion: 0.05
Nodes (47): AuthProvider(), RAJNANDGAON_CENTER, SavedAddress, Session, PhoneUpdateModal(), PhoneUpdateModalProps, MediaLibraryPicker(), MediaLibraryPickerProps (+39 more)

### Community 5 - "backend/package.json"
Cohesion: 0.03
Nodes (78): axios, cors, express, helmet, jspdf, mammoth, papaparse, pg (+70 more)

### Community 6 - "useAuthStore"
Cohesion: 0.05
Nodes (51): AUTHORIZED_INTERNAL_EMAILS, react, AdminGuard(), AuthGuard(), CustomerGuard(), DeliveryGuard(), DeveloperGuard(), OwnerGuard() (+43 more)

### Community 7 - "useDataStore"
Cohesion: 0.06
Nodes (54): Wishlist(), CATEGORY_DEFS, CategoryCapsules(), CategoryDef, FeaturedShowcase(), Props, RecommendationTab, AdItem (+46 more)

### Community 8 - "app.ts"
Cohesion: 0.05
Nodes (42): allowedOrigins, devOrigins, containsTechnicalLeak(), errorSanitizerMiddleware(), generateReferenceId(), sanitizeErrorDetails(), verifyTurnstile(), versionCheck() (+34 more)

### Community 9 - "delivery.routes.ts"
Cohesion: 0.06
Nodes (24): deliveryStatusSchema, handleLocationUpdate(), partnerStatusSchema, calculateDistanceMeters(), processRiderOrderAction(), GpsValidationResult, DeliveryCapacityService, DeliveryPartner (+16 more)

### Community 10 - "homePageManager.routes.ts"
Cohesion: 0.05
Nodes (31): router, upload, RedisService, BUILT_IN_TEMPLATES, FALLBACK_STANDARD_SCHEMA, LivePointer, PagePackageService, ActionPayload (+23 more)

### Community 11 - "postgres.ts"
Cohesion: 0.05
Nodes (29): run(), connectionTimeoutMillis, DatabaseEnvironment, idleTimeoutMillis, isCloudPostgres, isRenderPostgres, maxConnections, pgPool (+21 more)

### Community 12 - "backend/server.ts"
Cohesion: 0.06
Nodes (30): app, server, app, initPostgres(), validateEnvironmentVariables(), AbandonedCartJob, AbandonedCartResult, AIHeartbeatJob (+22 more)

### Community 13 - "lucide-react"
Cohesion: 0.04
Nodes (32): AddToCartAnimationProps, AddToCartAnimPayload, CancelDeliveryModalProps, PRESET_REASONS, AIDiagnosticsConsole(), devFetch(), REVIEWS, Testimonial (+24 more)

### Community 14 - "WebsiteConfigService.ts"
Cohesion: 0.07
Nodes (21): ABTestingService, CampaignService, VersionHistoryService, DEFAULT_FEATURE_FLAGS, DEFAULT_HOMEPAGE_CONFIG, DEFAULT_NAVIGATION_CONFIG, DEFAULT_THEME_CONFIG, WebsiteConfigService (+13 more)

### Community 15 - "aiImage.routes.ts"
Cohesion: 0.09
Nodes (20): router, AIImageService, historyList, tempImageStore, TemporaryImageRecord, VersionRecord, AI_IMAGE_MODELS, AIImageModelSpec (+12 more)

### Community 16 - "dependencies"
Cohesion: 0.04
Nodes (54): dependencies, adm-zip, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, bcrypt, @capacitor/android, @capacitor/app (+46 more)

### Community 17 - "privacy.routes.ts"
Cohesion: 0.08
Nodes (15): requireAdmin, router, CUSTOMER_ALWAYS_EMAIL_STAGES, EmailRulesEngine, NO_EMAIL_ROLES, NotificationQueueService, DataCorrectionPayload, DeletionRequestRecord (+7 more)

### Community 18 - "frontend/package.json"
Cohesion: 0.05
Nodes (43): @types/papaparse, jspdf, papaparse, zod, name, private, type, version (+35 more)

### Community 19 - "src/App.tsx"
Cohesion: 0.08
Nodes (34): Ads, AIHealthMonitor, AIKnowledge, Analytics, Coupons, Customers, Dashboard, DataManager (+26 more)

### Community 20 - "getPaymentConfig"
Cohesion: 0.13
Nodes (13): getPaymentConfig(), CashfreeProvider, MockSandboxProvider, CreateIntentParams, CreateIntentResult, CreateRefundParams, PaymentProvider, ProviderHealthResult (+5 more)

### Community 21 - "auth.middleware.ts"
Cohesion: 0.07
Nodes (28): AuthRequest, logSecurityEventServer(), optionalAuth(), requireBranchScope(), requirePermission(), requireRole(), requireTerminalScope(), verifyToken() (+20 more)

### Community 22 - "dependencies"
Cohesion: 0.04
Nodes (45): dependencies, canvas-confetti, @capacitor/android, @capacitor/app, @capacitor/browser, @capacitor/cli, @capacitor/core, @capacitor-firebase/authentication (+37 more)

### Community 23 - "frontend/src/App.tsx"
Cohesion: 0.08
Nodes (28): FranchiseWorkspace, Login, NotificationsCenter, RestaurantManagement, WorkspaceRedirect(), AuthProvider(), OwnerGuard(), CheckoutStep (+20 more)

### Community 24 - "query"
Cohesion: 0.09
Nodes (19): DATABASE_RESPONSIBILITY_MATRIX, EntityDataPolicy, checkPostgresHealth(), DATABASE_ENV, query(), withTransaction(), checkSupabaseHealth(), supabaseNav (+11 more)

### Community 25 - "user.routes.ts"
Cohesion: 0.09
Nodes (19): router, backend_src_security_index_apisecuritymiddleware, backend_src_security_index_authenticatedsecurityuser, backend_src_security_index_isuserauthorizedforapp, backend_src_security_index_resourceaccessservice, backend_src_security_index_responsesanitizationservice, ResourceAccessService, ResponseSanitizationService (+11 more)

### Community 26 - "TruecallerProvider"
Cohesion: 0.10
Nodes (10): FirebasePhoneVerificationProvider, OTPRequestResult, PhoneVerificationProvider, VerificationResult, PhoneVerificationService, TruecallerKey, TruecallerProvider, TruecallerWebSession (+2 more)

### Community 27 - "dependencies"
Cohesion: 0.05
Nodes (43): dependencies, adm-zip, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, bcrypt, cloudinary, cors (+35 more)

### Community 28 - "NotificationEngine.ts"
Cohesion: 0.08
Nodes (23): handleStreamPdf(), InventoryCategory, InventoryItem, StockHistoryRecord, StockStatus, StockUnit, NotificationCategory, NotificationEngine (+15 more)

### Community 29 - "location.routes.ts"
Cohesion: 0.08
Nodes (23): handleOrderingContextResolve(), citiesCache, CityInfo, geocodeCache, handleParallelSearch(), handleServiceabilityCheck(), nominatimQueuePromise, router (+15 more)

### Community 30 - "Ads.tsx"
Cohesion: 0.12
Nodes (21): AccountApprovals, SpecialCategories, CancelReasonModal(), CancelReasonModalProps, CANNED_REASONS, EmptyState(), EmptyStateProps, ErrorState() (+13 more)

### Community 31 - "pos.routes.ts"
Cohesion: 0.10
Nodes (12): runTests(), CanonicalOrderService, ESCPOSFormatter, ReceiptData, ReceiptItem, POSCalculateRequest, POSCalculateResponse, POSCartItem (+4 more)

### Community 32 - "DeliveryAlarmManagerClass"
Cohesion: 0.11
Nodes (14): OwnerAlertManager(), getAudioContext(), playDeliveryRingtone(), playNotificationSound(), playPOSAlarm(), playTone(), SOUNDS, SoundType (+6 more)

### Community 33 - "AppDelegate"
Cohesion: 0.06
Nodes (29): Any, Bool, Capacitor, Data, Error, AppDelegate, NSUserActivity, UIWindow (+21 more)

### Community 34 - "PushNotificationManager.tsx"
Cohesion: 0.08
Nodes (22): AddressBook(), getBrowserName(), isBatteryOptimized(), playNotificationSound(), PushNotificationManager(), startContinuousAlert(), stopContinuousAlert(), LocationPrompt() (+14 more)

### Community 35 - "runner.ts"
Cohesion: 0.06
Nodes (20): __dirname, __filename, pool, __dirname, pgPool, client, pgPool, __dirname (+12 more)

### Community 36 - "emailTemplates.service.ts"
Cohesion: 0.20
Nodes (37): API_BASE, FRONTEND_URL, baseWrapper(), buildDeliveryAssignedEmailSimple(), buildDeliveryCompletedEmail(), buildDeliveryNewAssignmentEmail(), buildDeliveryPartnerAssignedEmail(), buildEmailVerificationEmail() (+29 more)

### Community 37 - "TextToSpeech.service.ts"
Cohesion: 0.08
Nodes (27): buildInstruction(), buildPreAnnouncement(), getDirectionPhrase(), getNavLanguage(), getTTSLocale(), NavLanguage, PhraseMap, PHRASES (+19 more)

### Community 38 - "frontend/src/types/PageSchema.ts"
Cohesion: 0.09
Nodes (32): AnimationPreviewBadge(), AnimationPreviewBadgeProps, FontPreviewBadge(), FontPreviewBadgeProps, GOOGLE_FONT_MAPPING, HelpTooltip(), HelpTooltipProps, ACTION_OPTIONS (+24 more)

### Community 39 - "PaymentService.ts"
Cohesion: 0.08
Nodes (13): pool, CollectCashParams, CreateUpiAttemptParams, AuditLogEntry, PaymentAuditLogger, PaymentReconciliationService, ReconciliationReport, PaymentRecoveryQueue (+5 more)

### Community 40 - "frontend/src/types/models.ts"
Cohesion: 0.08
Nodes (29): Analytics, OrderManagement, Props, Props, EmergencyOrderModal(), EmergencyOrderModalProps, LiveMapModalProps, soundPlayer (+21 more)

### Community 41 - "payment.routes.ts"
Cohesion: 0.14
Nodes (11): query(), ALLOWED_PROVIDERS, CODCollectionService, ComponentHealth, PaymentHealthMonitor, PaymentProviderFactory, FinancialReport, PaymentReportingService (+3 more)

### Community 42 - "OrderStateMachine.ts"
Cohesion: 0.09
Nodes (18): computeEffectiveStatus(), LoyaltySummary, LoyaltyTransaction, ALLOWED_TRANSITIONS, CanonicalOrderStatus, normalizeStateMachineRole(), OrderStateMachine, ROLE_AUTHORITY (+10 more)

### Community 43 - "AppEventBus.ts"
Cohesion: 0.07
Nodes (31): AppEventBus, BaseOrderEvent, BillGeneratedEvent, DomainEventMap, DomainEventType, BILL_GENERATED, ORDER_ACCEPTED, ORDER_CANCELLED (+23 more)

### Community 44 - "report.routes.ts"
Cohesion: 0.12
Nodes (9): handleListMonthlyReports(), router, CloudflareReportService, GoogleSheetsReportService, MonthlyPdfOptions, MonthlyPdfReportService, MonthlyReportGenerator, ref_jspdf (+1 more)

### Community 45 - "InMemoryBillingRepository"
Cohesion: 0.09
Nodes (4): FirestoreBillingRepository, IBillingRepository, InMemoryBillingRepository, PostgresBillingRepository

### Community 46 - "src/lib/firebase.ts"
Cohesion: 0.13
Nodes (20): ref_capacitor_firebase_authentication, Login, OwnerGuard(), Header(), MobileNav(), OwnerLayout(), PizzaLoader(), initFCMNotifications() (+12 more)

### Community 47 - "franchise.routes.ts"
Cohesion: 0.12
Nodes (10): DEFAULT_ORGANIZATION, FranchiseEntity, PosAccountService, AppAuthorizationResult, FranchiseAccessEntry, FranchiseAccessService, ResolveAppAuthorizationParams, FranchiseLifecycleService (+2 more)

### Community 48 - "DeliveryLocationService.java"
Cohesion: 0.11
Nodes (20): android.app.Notification, android.app.Service, DeliveryLocationService, Override, android.content.Intent, android.location.Location, android.os.IBinder, androidx.annotation.Nullable (+12 more)

### Community 49 - "MainActivity.java"
Cohesion: 0.10
Nodes (24): AlarmActivity, Override, android.os.Bundle, arrays, com.getcapacitor.BridgeActivity, executors, executorservice, firebaseauth (+16 more)

### Community 50 - "KnowledgeBaseService"
Cohesion: 0.11
Nodes (4): KnowledgeBaseService, STATIC_FAQ, STATIC_POLICIES, WEBSITE_PAGES

### Community 51 - "auth.routes.ts"
Cohesion: 0.14
Nodes (5): RFC-6238, LoginRateLimiterService, PosPinService, TOTPService, ref_google_cloud_recaptcha_enterprise

### Community 52 - "ref_path"
Cohesion: 0.15
Nodes (10): KnowledgeFileType, KnowledgeGeneratorService, KnowledgePayload, KnowledgeMemoryStore, KnowledgeSyncService, LOCAL_CACHE_DIR, R2ObjectMetadata, ref_aws_sdk_client_s3 (+2 more)

### Community 53 - "order_data_minimization.test.ts"
Cohesion: 0.08
Nodes (24): CustomerOrderProjection, DeliveryRiderOrderProjection, FranchiseManagerOrderProjection, OwnerOrderProjection, POSOrderProjection, RestaurantManagerOrderProjection, custObj, customerAuthorized (+16 more)

### Community 54 - "com.getcapacitor.PluginCall"
Cohesion: 0.22
Nodes (9): DeliveryPlugin, AlarmPermissionPlugin, Override, TruecallerPlugin, com.getcapacitor.annotation.CapacitorPlugin, com.getcapacitor.Plugin, com.getcapacitor.PluginCall, com.getcapacitor.PluginMethod (+1 more)

### Community 55 - "OwnerLiveMap.tsx"
Cohesion: 0.12
Nodes (15): DeliveryPoint, getFreshnessBadge(), offlineIcon, onlineIcon, OwnerLiveMap(), customerIcon, restaurantMapIcon, riderIcon (+7 more)

### Community 56 - "Products.tsx"
Cohesion: 0.14
Nodes (19): Products, uploadMediaToCloudinary(), UploadResult, uploadViaBackend(), getOptimizedImageUrl(), getOptimizedVideoUrl(), getResponsiveImageSrcSet(), getVideoPosterUrl() (+11 more)

### Community 57 - "OliveMessagingService.java"
Cohesion: 0.13
Nodes (12): android.app.NotificationManager, Override, OliveMessagingService, audioattributes, Builder, com.capacitorjs.plugins.pushnotifications.MessagingService, com.google.firebase.messaging.RemoteMessage, hashmap (+4 more)

### Community 58 - "AIContextBuilder.ts"
Cohesion: 0.11
Nodes (12): AIContextBuilder, classifyIntent(), ContextBuildResult, DetailedSearchResult, NON_RESTAURANT_BYPASS_KEYWORDS, queryContextCache, QueryIntent, RESTAURANT_KEYWORDS (+4 more)

### Community 59 - "services/email.service.ts"
Cohesion: 0.11
Nodes (15): alertCooldowns, DevAlertOptions, DevAlertService, cleanSmtpFrom, createSmtpTransporter(), defaultFromAddress, emailPollingTimer, envPort (+7 more)

### Community 60 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, lib, module, moduleResolution (+12 more)

### Community 61 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 62 - "EmailService"
Cohesion: 0.21
Nodes (3): EmailService, transporter, ref_nodemailer

### Community 63 - "media.routes.ts"
Cohesion: 0.16
Nodes (7): ALLOWED_FOLDERS, router, uploadMiddleware, verifyAdminOrOwner, BackgroundTaskWorker, MediaOptimizationService, ref_multer

### Community 64 - "motion.ts"
Cohesion: 0.11
Nodes (16): PageTransitionProps, buttonPressVariants, card3DHoverVariants, DURATION_COMPONENT, DURATION_MICRO, DURATION_PAGE, EASE_IN_OUT_CUBIC, EASE_OUT_BACK (+8 more)

### Community 65 - "Ferrofluid.tsx"
Cohesion: 0.13
Nodes (12): Ferrofluid(), flowVec(), hexToRGB(), prepColors(), Galaxy(), defaultColors, hexToRgb(), Particles() (+4 more)

### Community 66 - "ai.routes.ts"
Cohesion: 0.14
Nodes (11): actionTimestamps, audioUpload, hourlyMessageCounts, router, AIFirewallFilter, FirewallCheckOptions, conversationMemory, evaluateLLMs() (+3 more)

### Community 67 - ".logEvent"
Cohesion: 0.19
Nodes (4): EmailVerificationService, PasswordResetWorkflowService, assert(), runSecuritySuite()

### Community 68 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 69 - "MainActivity"
Cohesion: 0.23
Nodes (4): android.app.Activity, Override, MainActivity, android.content.Context

### Community 70 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, @types/adm-zip, @types/bcrypt, @types/cors, @types/express, @types/ioredis, @types/morgan, @types/multer (+10 more)

### Community 71 - "health.stream.routes.ts"
Cohesion: 0.14
Nodes (10): checkAIProviders(), clients, gatherMetrics(), getEnvStatus(), router, startPoller(), LatLng, router (+2 more)

### Community 72 - "StaticKnowledgeLoader.ts"
Cohesion: 0.24
Nodes (17): buildStaticContext(), __dirname, ensureLoaded(), __filename, findPolicy(), findRoute(), getAboutContext(), getAllStaticFaqs() (+9 more)

### Community 73 - "LiveOrders.tsx"
Cohesion: 0.18
Nodes (15): LiveOrders, LiveMapModal(), LiveMapModalProps, LiveOrders(), parseOrderTime(), Advertisement, Coupon, DeliveryPartner (+7 more)

### Community 74 - "ref_fs"
Cohesion: 0.32
Nodes (4): dynamicHtmlInjector(), getMetaTags(), CloudflareR2Service, ref_fs

### Community 75 - "dataManager.routes.ts"
Cohesion: 0.27
Nodes (3): router, DatabaseManagerService, DatabaseRole

### Community 76 - "execute_complete_rebuild.ts"
Cohesion: 0.15
Nodes (16): AUDIT_ADJUSTMENTS_HEADERS, DAILY_SALES_HEADERS, DISCOUNTS_COUPONS_HEADERS, formatItemsSummary(), getSheetsClient(), GST_TAX_HEADERS, MONTHLY_SUMMARY_HEADERS, ORDER_DETAILS_HEADERS (+8 more)

### Community 77 - "migrate_google_sheets.ts"
Cohesion: 0.15
Nodes (16): AUDIT_ADJUSTMENTS_HEADERS, DAILY_SALES_HEADERS, DISCOUNTS_COUPONS_HEADERS, executeMigration(), formatItemsSummary(), getSheetsClient(), GST_TAX_HEADERS, MONTHLY_SUMMARY_HEADERS (+8 more)

### Community 78 - "versionManager.ts"
Cohesion: 0.25
Nodes (13): CustomerProfile(), AccountSettings(), NativeAppUpdater(), ForceUpdateScreen(), UpdateBanner(), APP_VERSION, checkVersion(), compareVersions() (+5 more)

### Community 79 - "src/components/orders/EmergencyOrderModal.tsx"
Cohesion: 0.18
Nodes (9): NotificationCenter, Settings, EmergencyOrderModal(), EmergencyOrderModalProps, soundPlayer, SoundSynthesizer, useOwnerSettingsStore, NotificationCenter() (+1 more)

### Community 80 - "security.config.ts"
Cohesion: 0.13
Nodes (10): adminLimiter, authLimiter, expensiveLimiter, otpLimiter, publicLimiter, Schemas, userLimiter, router (+2 more)

### Community 81 - "riderDelivery.routes.ts"
Cohesion: 0.19
Nodes (6): DeliveryDataLifecycleService, MonthlyDeliverySummary, BranchRingBufferEvent, ConnectedClient, DriverLocationData, ref_ws

### Community 84 - "DeliveryMap.tsx"
Cohesion: 0.14
Nodes (12): DeliveryMap, DeliveryMapProps, pulsingIcon, NetworkSpeed, NetworkState, useNetworkStore, ServiceState, StartupState (+4 more)

### Community 85 - "AICacheService"
Cohesion: 0.17
Nodes (4): aiCache, AICacheService, TTL_MAP, AIContextService

### Community 86 - "CanonicalOrderService.ts"
Cohesion: 0.16
Nodes (11): billingRepository, PermanentBillRecord, AllocatedBillNumbers, CreateOrderParams, SearchOrderFilters, CancelledOrderRow, CompleteBillLedgerRow, DailyLedgerRow (+3 more)

### Community 87 - "devops.routes.ts"
Cohesion: 0.24
Nodes (5): DevOpsService, LOG_DIR, LOG_FILE, NotificationLogEntry, NotificationLogger

### Community 88 - "kitchen.routes.ts"
Cohesion: 0.29
Nodes (4): ALLOWED_ROLES, requireKitchenAccess(), router, KitchenInventoryService

### Community 89 - "ai.service.ts"
Cohesion: 0.25
Nodes (13): enhancePrompt(), fetchProductContext(), generateEmailTemplate(), generateImage(), generateProductDescription(), generateProductImage(), getFallbackClient(), getGeminiClient() (+5 more)

### Community 90 - "DatabaseProviderRegistry.ts"
Cohesion: 0.13
Nodes (13): ManagedDatabaseRecord, ConnectionTestBreakdown, DatabaseCapability, ProviderCategory, ProviderDefinition, ProviderDocumentation, ProviderFieldDefinition, ProviderRequirementsSummary (+5 more)

### Community 91 - "UniversalMap3D.tsx"
Cohesion: 0.20
Nodes (13): LocationPicker3D(), LocationPicker3DProps, CARTO_RASTER_STYLE, customerMarkerHTML(), injectCSS(), LatLng, MemoizedUniversalMap3D, restaurantMarkerHTML() (+5 more)

### Community 92 - "OlivePizzaAISDK.ts"
Cohesion: 0.14
Nodes (10): AIResponse, AIRoutingService, IntentType, ChatMessage, ChatRequestOptions, EmailTemplateOptions, EnhancePromptOptions, ProductDescriptionOptions (+2 more)

### Community 93 - "notification.service.ts"
Cohesion: 0.18
Nodes (7): SystemListener, DEFAULT_CHANNELS, NotificationCategory, NotificationEvent, NotificationService, QueueItem, ref_os

### Community 95 - "SheetsSyncWorker"
Cohesion: 0.22
Nodes (4): recordTest(), runFullVerificationSuite(), POSTelemetryHealthService, SheetsSyncWorker

### Community 96 - "AIOperationsStore"
Cohesion: 0.14
Nodes (5): aiProviderStats, AIDiagnosticLog, AIOperationsStore, ImageGenLog, SMSLog

### Community 97 - "FranchiseScopeService"
Cohesion: 0.25
Nodes (5): CANONICAL_ROLES, FranchiseScopeService, calculateHaversineDistanceMeters(), verifyDelivery100mRule(), runTests()

### Community 98 - "googleDrive.service.ts"
Cohesion: 0.19
Nodes (5): __dirname, DriveUploadResult, __filename, GoogleDriveService, ref_stream

### Community 100 - "OwnerLiveMapModal.tsx"
Cohesion: 0.15
Nodes (9): MapMarker, OwnerLiveMapModalProps, RiderLocation, RESTAURANT_LOCATION, DeliveryLocation, supabase, supabaseAnonKey, supabaseUrl (+1 more)

### Community 101 - "scheduling.ts"
Cohesion: 0.26
Nodes (12): CountdownTimer(), CountdownTimerProps, extractDate(), filterActive(), formatCountdown(), getItemExpiryDate(), getItemStartDate(), getScheduleStatus() (+4 more)

### Community 102 - "GoogleSheetsReportService.ts"
Cohesion: 0.17
Nodes (6): OrderEventServiceImpl, FranchiseSheetsMetadata, MonthlySyncParams, FranchiseReportMeta, OrderRowData, ref_googleapis

### Community 104 - "inventory.routes.ts"
Cohesion: 0.29
Nodes (4): router, InventoryItem, InventoryService, StockAdjustment

### Community 106 - "PaymentEventQueue.ts"
Cohesion: 0.26
Nodes (4): InvoiceEngine, InvoiceParams, PaymentEventPayload, PaymentEventQueue

### Community 107 - "Truecaller.ts"
Cohesion: 0.23
Nodes (8): TruecallerQRModal(), TruecallerQRModalProps, Truecaller, TruecallerNativeResult, TruecallerPlugin, TruecallerService, TruecallerSessionStatusResponse, TruecallerWebSessionResponse

### Community 108 - "frontend/src/lib/imageOptimizer.ts"
Cohesion: 0.21
Nodes (11): getOptimizedVideoUrl(), getResponsiveImageSrcSet(), getVideoPosterUrl(), ImageCrop, ImageGravity, ImageOptimizationOptions, ImageQuality, isCloudinaryTransformSegment() (+3 more)

### Community 109 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, build:backend, build:electron, build:frontend, build:mac, desktop, dev (+4 more)

### Community 110 - "verify_owner_app.cjs"
Cohesion: 0.17
Nodes (10): dataManagerFiles, fs, indexHtml, ownerComponents, path, publicAssets, ROOT, rootConfigs (+2 more)

### Community 111 - "ExampleInstrumentedTest.java"
Cohesion: 0.27
Nodes (7): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, instrumentationregistry, org.junit.runner.RunWith, org.junit.Test

### Community 112 - "TruecallerPlugin.java"
Cohesion: 0.18
Nodes (10): color, com.truecaller.android.sdk.ITrueCallback, handler, jsobject, looper, nonnull, truecallersdk, truecallersdkscope (+2 more)

### Community 114 - "github.routes.ts"
Cohesion: 0.22
Nodes (6): requireAuth, getTargetRepo(), redirectReleaseAsset(), router, router, HeartbeatService

### Community 115 - "DeepSeekV4FlashGenerator.ts"
Cohesion: 0.27
Nodes (6): APPROVED_MODEL_HIERARCHY, DeepSeekV4FlashGenerator, executeModelChain(), getClientForProvider(), ModelCandidate, ref_openai

### Community 117 - "PaymentErrorHandler.ts"
Cohesion: 0.24
Nodes (5): PaymentErrorCode, PaymentErrorHandler, StructuredPaymentError, PaymentRetryEngine, RetryTask

### Community 118 - "firebase-messaging-sw.js"
Cohesion: 0.38
Nodes (9): BROADCAST, flushOfflineActions(), getAndClearOfflineActions(), getCachedAuthToken(), messaging, openDB(), openWindow(), performQuickAction() (+1 more)

### Community 119 - "frontend/src/main.tsx"
Cohesion: 0.20
Nodes (5): App(), Props, SafeErrorBoundary, State, frontend_src_index

### Community 120 - "aiIntegration.routes.ts"
Cohesion: 0.27
Nodes (5): getAIGatewaySecret(), requireAISignature(), router, AIEventStreamService, Client

### Community 121 - "toolExecutor.ts"
Cohesion: 0.33
Nodes (8): executeBackendTool(), ToolCallRequest, ToolCallResponse, AI_TOOLS, isAuthRequiredForTool(), isClientSideTool(), TOOL_SCHEMAS_OPENAI, ToolDefinition

### Community 126 - "ErrorBoundary.tsx"
Cohesion: 0.22
Nodes (5): ErrorBoundary, Props, State, LoadingState, useLoadingStore

### Community 127 - "platform.ts"
Cohesion: 0.33
Nodes (6): AppDownloadSection(), getPushCompatibility(), isCapacitorNative(), isIOS(), isMacOS(), isSafari()

### Community 128 - "LegalPageLayout.tsx"
Cohesion: 0.22
Nodes (6): HighlightCard, LegalPageLayoutProps, TocItem, SEO(), SEOProps, react-helmet-async

### Community 129 - "ui/SafeErrorBoundary.tsx"
Cohesion: 0.22
Nodes (5): Props, SafeErrorBoundary, State, initCrashLogger(), logCrash()

### Community 130 - "payment.config.ts"
Cohesion: 0.22
Nodes (6): currentConfig, PaymentConfig, updatePaymentConfig(), FraudCheckParams, FraudCheckResult, FraudProtectionEngine

### Community 131 - "coupon.routes.ts"
Cohesion: 0.28
Nodes (3): DataExpiryJob, router, CorrelationLogger

### Community 133 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/canvas-confetti, @types/leaflet, @types/maplibre-gl, @types/node, @types/papaparse, @types/react, @types/react-dom (+1 more)

### Community 134 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 135 - "FlagshipFooter.tsx"
Cohesion: 0.39
Nodes (7): FacebookIcon(), FlagshipFooter(), InstagramIcon(), TwitterIcon(), YoutubeIcon(), StoreStatus, useStoreStatus()

### Community 136 - "CatalogGuard.ts"
Cohesion: 0.36
Nodes (4): CatalogGuard, FORBIDDEN_MENU_TERMS, ValidationResult, KBProduct

### Community 138 - "franchise-security.test.ts"
Cohesion: 0.36
Nodes (7): getIdTokenForUser(), recordFail(), recordPass(), results, runSecurityTests(), TestResult, ref_bcrypt

### Community 140 - "homeLayout.ts"
Cohesion: 0.25
Nodes (7): DEFAULT_SECTIONS, DEFAULT_TOP_SELLING, HomeLayoutState, HomeSection, TopSellingConfig, useHomeLayoutStore, VersionEntry

### Community 142 - "brandLock.ts"
Cohesion: 0.39
Nodes (7): APPROVED_HEX, BLOCKED_PATTERNS, BRAND_COLORS, enforceAllSectionsBrand(), enforceBrandColors(), hasBlockedColor(), isApprovedColor()

### Community 143 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 144 - "src/pages/HomePageManager.tsx"
Cohesion: 0.32
Nodes (6): HomePageManager, DEFAULT_SECTIONS, HomePageManager(), SDUIConfig, SDUIHistory, SDUISection

### Community 145 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 146 - "NotificationActionReceiver"
Cohesion: 0.43
Nodes (3): Override, NotificationActionReceiver, android.content.BroadcastReceiver

### Community 150 - "main.cjs"
Cohesion: 0.29
Nodes (5): { app, BrowserWindow, ipcMain }, createWindow(), path, { contextBridge, ipcRenderer }, electron

### Community 151 - "useNotificationDebugger.ts"
Cohesion: 0.38
Nodes (5): NotificationDiagnosticsOverlay(), DebugStep, DiagnosticTrace, NotificationDebuggerState, useNotificationDebugger

### Community 153 - "auditSupabaseUsage.cjs"
Cohesion: 0.33
Nodes (5): fs, path, repos, results, searchDir()

### Community 157 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 159 - "errorTranslator.ts"
Cohesion: 0.67
Nodes (4): delay(), withAuthRetry(), logDetailedError(), translateError()

### Community 160 - "frontend/src/lib/utils.ts"
Cohesion: 0.40
Nodes (4): CLOSING_HOUR, OPENING_HOUR, calculateDistance(), deg2rad()

### Community 162 - "analyticsTracker.ts"
Cohesion: 0.47
Nodes (5): eventQueue, flushQueue(), getSessionId(), QueuedEvent, trackSDUIEvent()

### Community 163 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, electron, electron-builder, @types/cors, @types/express, @types/node

### Community 164 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, test

### Community 166 - "languageDetector.ts"
Cohesion: 0.50
Nodes (3): detectLanguage(), HINGLISH_MARKERS, SupportedLanguage

### Community 169 - "capacitor.config.ts"
Cohesion: 0.40
Nodes (3): config, config, ref_capacitor_cli

### Community 170 - "useLiveMetrics.ts"
Cohesion: 0.60
Nodes (4): getTimestampMillis(), MetricsState, useLiveMetrics(), useLiveMetricsStore

### Community 174 - "frontend/vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, rewrites

### Community 175 - "vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, rewrites

### Community 176 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 184 - "frontend/src/types/sdui.ts"
Cohesion: 0.50
Nodes (3): SDUIConfig, SDUIHistory, SDUISection

### Community 185 - "src/main.tsx"
Cohesion: 0.50
Nodes (3): react-dom, App(), src_index

## Knowledge Gaps
- **1039 isolated node(s):** `Props`, `DeclineDeliveryReasonModalProps`, `CravingCategory`, `CravingProductItem`, `StoryCard` (+1034 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1536 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `LegalPageLayout.tsx`, `ui/SafeErrorBoundary.tsx`, `fetchApi`, `react-hot-toast`, `useAuthStore`, `useDataStore`, `FlagshipFooter.tsx`, `lucide-react`, `src/pages/HomePageManager.tsx`, `frontend/package.json`, `src/App.tsx`, `frontend/src/App.tsx`, `useNotificationDebugger.ts`, `Ads.tsx`, `DeliveryAlarmManagerClass`, `PushNotificationManager.tsx`, `frontend/src/types/PageSchema.ts`, `frontend/src/types/models.ts`, `useLiveMetrics.ts`, `src/lib/firebase.ts`, `ClickSpark.tsx`, `OwnerLiveMap.tsx`, `Products.tsx`, `src/main.tsx`, `motion.ts`, `Ferrofluid.tsx`, `LiveOrders.tsx`, `versionManager.ts`, `src/components/orders/EmergencyOrderModal.tsx`, `DeliveryMap.tsx`, `UniversalMap3D.tsx`, `OwnerLiveMapModal.tsx`, `scheduling.ts`, `Truecaller.ts`, `frontend/src/main.tsx`, `DevUI.tsx`, `ErrorBoundary.tsx`, `platform.ts`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `react`, `LegalPageLayout.tsx`, `fetchApi`, `ui/SafeErrorBoundary.tsx`, `react-hot-toast`, `useAuthStore`, `useDataStore`, `FlagshipFooter.tsx`, `Footer.tsx`, `src/pages/HomePageManager.tsx`, `frontend/package.json`, `src/App.tsx`, `frontend/src/App.tsx`, `useNotificationDebugger.ts`, `Ads.tsx`, `DeliveryAlarmManagerClass`, `PushNotificationManager.tsx`, `frontend/src/types/PageSchema.ts`, `frontend/src/types/models.ts`, `src/lib/firebase.ts`, `OwnerLiveMap.tsx`, `Products.tsx`, `LiveOrders.tsx`, `versionManager.ts`, `src/components/orders/EmergencyOrderModal.tsx`, `UniversalMap3D.tsx`, `OwnerLiveMapModal.tsx`, `Truecaller.ts`, `frontend/src/main.tsx`, `DevUI.tsx`, `platform.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `adminDb` connect `config/firebase.ts` to `order.routes.ts`, `coupon.routes.ts`, `app.ts`, `delivery.routes.ts`, `homePageManager.routes.ts`, `postgres.ts`, `backend/server.ts`, `franchise-security.test.ts`, `WebsiteConfigService.ts`, `privacy.routes.ts`, `auth.middleware.ts`, `query`, `user.routes.ts`, `TruecallerProvider`, `NotificationEngine.ts`, `location.routes.ts`, `pos.routes.ts`, `PaymentService.ts`, `payment.routes.ts`, `OrderStateMachine.ts`, `report.routes.ts`, `franchise.routes.ts`, `auth.routes.ts`, `ref_path`, `services/email.service.ts`, `health.stream.routes.ts`, `ref_fs`, `execute_complete_rebuild.ts`, `migrate_google_sheets.ts`, `security.config.ts`, `riderDelivery.routes.ts`, `AICacheService`, `CanonicalOrderService.ts`, `DatabaseProviderRegistry.ts`, `GoogleSheetsReportService.ts`, `inventory.routes.ts`, `restaurantManager.routes.ts`, `github.routes.ts`, `aiIntegration.routes.ts`, `toolExecutor.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `Props`, `DeclineDeliveryReasonModalProps`, `CravingCategory` to the rest of the system?**
  _1039 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.025070028011204483 - nodes in this community are weakly interconnected._
- **Should `config/firebase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.041237113402061855 - nodes in this community are weakly interconnected._
- **Should `fetchApi` be split into smaller, more focused modules?**
  _Cohesion score 0.03903508771929825 - nodes in this community are weakly interconnected._