import SwiftUI

// MARK: - User
struct User: Codable, Equatable {
    let id: Int
    let email: String
    let name: String
    let role: String
    let department: String?
    let departments: [String]?
    let position: String?
    let avatar: String?
    let phone: String?

    var firstName: String { name.components(separatedBy: " ").first ?? name }
}

// MARK: - Shift (published schedule)
struct Shift: Codable, Identifiable {
    let id: Int
    let employeeId: Int?
    let date: String
    let start: String
    let end: String
    let department: String
    let position: String?
    let location: String?
    let notes: String?

    var timeRange: String { "\(start.prefix(5))–\(end.prefix(5))" }

    var weekday: String {
        guard let d = DateFormatters.apiDate.date(from: date) else { return date }
        return DateFormatters.weekday.string(from: d)
    }
    var shortDate: String {
        guard let d = DateFormatters.apiDate.date(from: date) else { return date }
        return DateFormatters.shortDate.string(from: d)
    }
    var fullDate: String {
        guard let d = DateFormatters.apiDate.date(from: date) else { return date }
        return DateFormatters.fullDate.string(from: d)
    }
    var deptColor: Color { DeptTheme.color(for: department) }
}

// MARK: - Time Off
struct TimeOffRequest: Codable, Identifiable {
    let id: Int
    let startDate: String
    let endDate: String
    let reason: String?
    let status: String
    let reviewNotes: String?
    let createdAt: String?

    var statusColor: Color {
        switch status {
        case "approved": return .green
        case "denied":   return .red
        default:         return Color(hex: "#F59E0B")
        }
    }
    var statusLabel: String { status.capitalized }
    var dateRange: String { "\(startDate) → \(endDate)" }
}

// MARK: - Open Shift
struct OpenShift: Codable, Identifiable {
    let id: Int
    let date: String
    let start: String
    let end: String
    let department: String
    let position: String?
    let notes: String?

    var timeRange: String { "\(start.prefix(5))–\(end.prefix(5))" }
    var weekday: String {
        guard let d = DateFormatters.apiDate.date(from: date) else { return date }
        return DateFormatters.weekday.string(from: d)
    }
    var shortDate: String {
        guard let d = DateFormatters.apiDate.date(from: date) else { return date }
        return DateFormatters.shortDate.string(from: d)
    }
    var deptColor: Color { DeptTheme.color(for: department) }
}

// MARK: - Timecard
struct Timecard: Codable, Identifiable {
    let id: Int
    let clockIn: String?
    let clockOut: String?
    let date: String?
    let notes: String?
    let status: String?

    var clockInDate: Date? {
        guard let s = clockIn else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }
    var clockOutDate: Date? {
        guard let s = clockOut else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }
    var hoursWorked: Double? {
        guard let i = clockInDate, let o = clockOutDate else { return nil }
        return o.timeIntervalSince(i) / 3600
    }
    var hoursString: String? {
        guard let h = hoursWorked else { return nil }
        let hrs = Int(h); let mins = Int((h - Double(hrs)) * 60)
        return mins > 0 ? "\(hrs)h \(mins)m" : "\(hrs)h"
    }
    var displayTime: String {
        let fmt = DateFormatters.time
        let inStr  = clockInDate.map  { fmt.string(from: $0) } ?? "—"
        let outStr = clockOutDate.map { fmt.string(from: $0) } ?? "—"
        return "\(inStr) – \(outStr)"
    }
}

// MARK: - Announcement
struct Announcement: Codable, Identifiable {
    let id: Int
    let title: String
    let body: String
    let author: String?
    let authorAvatar: String?
    let department: String?
    let priority: String?
    let date: String?
}

// MARK: - Home response
struct HomeData: Codable {
    let nextShift: Shift?
    let upcomingShifts: [Shift]
    let announcements: [Announcement]
}

// MARK: - Dept theme  (matches tailwind.config.js exactly)
enum DeptTheme {
    static func color(for dept: String) -> Color {
        switch dept {
        case "Aquatics":        return Color(hex: "#00C8FF")   // aq  — electric blue
        case "Guest Services":  return Color(hex: "#B455FF")   // gs  — bright violet
        case "Food & Beverage": return Color(hex: "#FF7A00")   // fb  — hot orange
        case "Cleaning Crew":   return Color(hex: "#2DDE98")   // cc  — mint green
        case "Management":      return Color(hex: "#FFD200")   // mgmt — gold
        default:                return Color(white: 0.5)
        }
    }
}

// MARK: - Date formatters
enum DateFormatters {
    static let apiDate: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    static let weekday: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE"; return f
    }()
    static let shortDate: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f
    }()
    static let fullDate: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"; return f
    }()
    static let time: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
}

// MARK: - Color hex init
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >>  8) & 0xFF) / 255
        let b = Double((int      ) & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

// MARK: - App colors  (mirrors tailwind.config.js tokens)
extension Color {
    static let bayouBG      = Color(hex: "#071520")   // void
    static let bayouSurface = Color(hex: "#0C2035")   // deep
    static let bayouShell   = Color(hex: "#143050")   // shell — elevated
    static let bayouBorder  = Color(hex: "#1E4568")   // rim
    static let bayouInk     = Color(hex: "#E8F4FF")   // ink — primary text
    static let bayouFogHi   = Color(hex: "#8BB8D4")   // fog-hi
    static let bayouMuted   = Color(hex: "#5A8AAA")   // fog
    static let bayouCyan    = Color(hex: "#00C8FF")   // cyan
    static let bayouGold    = Color(hex: "#FFD200")   // gold
}
