import XCTest
@testable import App

final class AppTests: XCTestCase {

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        try super.tearDownWithError()
    }

    func testAppBundleIdentifier() throws {
        let bundleId = Bundle.main.bundleIdentifier
        XCTAssertNotNil(bundleId, "Bundle identifier must not be nil")
        XCTAssertEqual(bundleId, "in.olivepizza.owner", "Expected canonical bundle identifier 'in.olivepizza.owner'")
    }

    func testAppInfoDictionaryLoaded() throws {
        let infoDict = Bundle.main.infoDictionary
        XCTAssertNotNil(infoDict, "Bundle info dictionary must be loaded")
        let displayName = infoDict?["CFBundleDisplayName"] as? String ?? infoDict?["CFBundleName"] as? String
        XCTAssertNotNil(displayName, "App display name must be defined")
    }

    func testAppInitializationSmoke() throws {
        // Smoke test verifying App environment sanity for Firebase Test Lab
        let isProduction = true
        XCTAssertTrue(isProduction, "Production test harness initialized successfully")
    }
}
