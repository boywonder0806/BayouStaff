import Foundation

private let BASE_URL = "http://68.183.101.51/api"

struct ServerError: Codable, LocalizedError {
    let error: String
    var errorDescription: String? { error }
}

@MainActor
final class APIClient {
    static let shared = APIClient()

    private(set) var token: String? {
        didSet {
            if let t = token { UserDefaults.standard.set(t, forKey: "jwt") }
            else { UserDefaults.standard.removeObject(forKey: "jwt") }
        }
    }

    init() { token = UserDefaults.standard.string(forKey: "jwt") }

    func logout() { token = nil }

    // MARK: - Core request helpers

    private func makeRequest(_ path: String, method: String) -> URLRequest {
        var req = URLRequest(url: URL(string: BASE_URL + path)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let t = token { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        return req
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            if let err = try? JSONDecoder().decode(ServerError.self, from: data) { throw err }
            throw URLError(.badServerResponse)
        }
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await perform(makeRequest(path, method: "GET"))
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var req = makeRequest(path, method: "POST")
        req.httpBody = try JSONEncoder().encode(body)
        return try await perform(req)
    }

    private func patch<T: Decodable>(_ path: String) async throws -> T {
        try await perform(makeRequest(path, method: "PATCH"))
    }

    private func delete(_ path: String) async throws {
        struct Empty: Decodable {}
        let _: Empty = try await perform(makeRequest(path, method: "DELETE"))
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> User {
        struct Body: Encodable { let email, password: String }
        struct Response: Decodable { let token: String; let user: User }
        let res: Response = try await post("/auth/login", body: Body(email: email, password: password))
        token = res.token
        return res.user
    }

    func me() async throws -> User {
        struct Response: Decodable { let user: User }
        let res: Response = try await get("/auth/me")
        return res.user
    }

    // MARK: - Home

    func homeData() async throws -> HomeData {
        try await get("/announcements/home")
    }

    // MARK: - Schedule

    func weekShifts(weekStart: String) async throws -> [Shift] {
        struct Response: Decodable { let shifts: [Shift] }
        let res: Response = try await get("/schedule?weekStart=\(weekStart)")
        return res.shifts
    }

    // MARK: - Time Off

    func timeOffRequests() async throws -> [TimeOffRequest] {
        struct Response: Decodable { let requests: [TimeOffRequest] }
        let res: Response = try await get("/time-off")
        return res.requests
    }

    func submitTimeOff(startDate: String, endDate: String, reason: String) async throws -> TimeOffRequest {
        struct Body: Encodable { let startDate, endDate, reason: String }
        struct Response: Decodable { let request: TimeOffRequest }
        let res: Response = try await post("/time-off", body: Body(startDate: startDate, endDate: endDate, reason: reason))
        return res.request
    }

    func cancelTimeOff(id: Int) async throws {
        try await delete("/time-off/\(id)")
    }

    // MARK: - Shift Board

    func openShifts() async throws -> [OpenShift] {
        struct Response: Decodable { let shifts: [OpenShift] }
        let res: Response = try await get("/shiftboard")
        return res.shifts
    }

    func claimShift(id: Int) async throws {
        struct Body: Encodable {}
        struct Response: Decodable { let success: Bool }
        let _: Response = try await post("/shiftboard/\(id)/claim", body: Body())
    }

    // MARK: - Timecards

    func timecards() async throws -> [Timecard] {
        struct Response: Decodable { let timecards: [Timecard] }
        let res: Response = try await get("/timecards")
        return res.timecards
    }

    func clockStatus() async throws -> Timecard? {
        struct Response: Decodable { let open: Timecard? }
        let res: Response = try await get("/timecards/status")
        return res.open
    }

    func clockIn() async throws -> Timecard {
        struct Body: Encodable {}
        struct Response: Decodable { let timecard: Timecard }
        let res: Response = try await post("/timecards/clock-in", body: Body())
        return res.timecard
    }

    func clockOut() async throws -> Timecard {
        struct Response: Decodable { let timecard: Timecard }
        let res: Response = try await patch("/timecards/clock-out")
        return res.timecard
    }
}
