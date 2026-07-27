"""Generate HND softcopy Word report for AttendPro attendance system."""
from __future__ import annotations

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, Twips
from docx.enum.style import WD_STYLE_TYPE

# --- Fill these when student provides details ---
STUDENT_NAME = "[YOUR FULL NAME]"
MATRIC_NO = "[YOUR MATRICULATION NUMBER]"
DEPARTMENT = "[YOUR DEPARTMENT, e.g. COMPUTER SCIENCE]"
SCHOOL = "[YOUR SCHOOL, e.g. SCHOOL OF APPLIED SCIENCES]"
POLYTECHNIC = "[NAME OF YOUR POLYTECHNIC]"
PROGRAMME = "HIGHER NATIONAL DIPLOMA (HND) IN COMPUTER SCIENCE"
SUPERVISOR = "[SUPERVISOR'S FULL NAME]"
HOD = "[HEAD OF DEPARTMENT'S NAME]"
SESSION = "JULY, 2026"
CASE_STUDY = "[NAME OF ORGANISATION / CASE STUDY]"
DEDICATION_FAMILY = "[YOUR PARENTS / FAMILY NAMES]"
FRIENDS = "[NAMES OF FRIENDS / CLASSMATES]"

TOPIC = (
    "DESIGN AND IMPLEMENTATION OF A COMPUTERISED STAFF ATTENDANCE "
    "SYSTEM USING PIN AND PHOTO VERIFICATION"
)

OUTPUT = r"C:\Users\Dell\Downloads\COMPUTERISED_STAFF_ATTENDANCE_PIN_PHOTO_VERIFICATION.docx"
OUTPUT2 = (
    r"C:\Users\Dell\Projects\staff-attendance-system\docs\COMPUTERISED_STAFF_ATTENDANCE_PIN_PHOTO_VERIFICATION.docx"
)


def set_run_font(run, size=12, bold=False, all_caps=False):
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    run.font.size = Pt(size)
    run.bold = bold
    run.font.all_caps = all_caps


def add_para(
    doc,
    text="",
    *,
    size=12,
    bold=False,
    align="justify",
    space_after=8,
    space_before=0,
    first_line=True,
):
    p = doc.add_paragraph()
    if align == "center":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == "right":
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif align == "left":
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    else:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    if first_line and align == "justify" and text:
        pf.first_line_indent = Inches(0.5)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    return p


def add_heading_center(doc, text, size=14):
    return add_para(doc, text, size=size, bold=True, align="center", first_line=False, space_after=12)


def add_heading_left(doc, text, size=12):
    return add_para(doc, text, size=size, bold=True, align="left", first_line=False, space_before=12, space_after=8)


def page_break(doc):
    doc.add_page_break()


def setup_doc():
    doc = Document()
    section = doc.sections[0]
    section.left_margin = Inches(2.0)
    section.right_margin = Inches(1.0)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    return doc


def title_page(doc):
    for _ in range(2):
        add_para(doc, "", first_line=False)
    add_heading_center(doc, TOPIC, size=14)
    add_para(doc, f"(A CASE STUDY OF {CASE_STUDY})", align="center", bold=True, first_line=False)
    add_para(doc, "", first_line=False)
    add_para(doc, "BY", align="center", bold=True, first_line=False)
    add_para(doc, "", first_line=False)
    add_heading_center(doc, STUDENT_NAME, size=13)
    add_heading_center(doc, MATRIC_NO, size=12)
    add_para(doc, "", first_line=False)
    add_para(
        doc,
        "A PROJECT SUBMITTED TO THE",
        align="center",
        bold=True,
        first_line=False,
    )
    add_para(doc, f"DEPARTMENT OF {DEPARTMENT}", align="center", bold=True, first_line=False)
    add_para(doc, SCHOOL, align="center", bold=True, first_line=False)
    add_heading_center(doc, POLYTECHNIC, size=12)
    add_para(doc, "", first_line=False)
    add_para(
        doc,
        "IN PARTIAL FULFILMENT OF THE REQUIREMENTS FOR THE AWARD OF",
        align="center",
        first_line=False,
    )
    add_heading_center(doc, PROGRAMME, size=12)
    add_para(doc, "", first_line=False)
    add_heading_center(doc, SESSION, size=12)
    page_break(doc)


def certification(doc):
    add_heading_center(doc, "CERTIFICATION")
    add_para(
        doc,
        f'This is to certify that this project titled "{TOPIC}" was carried out by '
        f"{STUDENT_NAME} with matriculation number {MATRIC_NO} in the Department of "
        f"{DEPARTMENT}, {POLYTECHNIC}, and has been read and approved as meeting the "
        f"requirements for the award of the {PROGRAMME}.",
    )
    add_para(doc, "", first_line=False)
    add_para(doc, "", first_line=False)
    add_para(doc, "______________________________", align="left", first_line=False)
    add_para(doc, SUPERVISOR, bold=True, align="left", first_line=False)
    add_para(doc, "(Project Supervisor)", align="left", first_line=False)
    add_para(doc, "Date: ____________________", align="left", first_line=False)
    add_para(doc, "", first_line=False)
    add_para(doc, "______________________________", align="left", first_line=False)
    add_para(doc, HOD, bold=True, align="left", first_line=False)
    add_para(doc, "(Head of Department)", align="left", first_line=False)
    add_para(doc, "Date: ____________________", align="left", first_line=False)
    add_para(doc, "", first_line=False)
    add_para(doc, "______________________________", align="left", first_line=False)
    add_para(doc, "External Examiner", bold=True, align="left", first_line=False)
    add_para(doc, "Date: ____________________", align="left", first_line=False)
    page_break(doc)


def approval(doc):
    add_heading_center(doc, "APPROVAL PAGE")
    add_para(
        doc,
        f"This project has been read and approved as meeting the requirements of the "
        f"Department of {DEPARTMENT}, {POLYTECHNIC}, for the award of the {PROGRAMME}.",
    )
    add_para(doc, "", first_line=False)
    add_para(doc, STUDENT_NAME, bold=True, align="left", first_line=False)
    add_para(doc, "(Student)", align="left", first_line=False)
    add_para(doc, "Signature/Date: ______________________", align="left", first_line=False)
    add_para(doc, "", first_line=False)
    add_para(doc, SUPERVISOR, bold=True, align="left", first_line=False)
    add_para(doc, "(Supervisor)", align="left", first_line=False)
    add_para(doc, "Signature/Date: ______________________", align="left", first_line=False)
    page_break(doc)


def dedication(doc):
    add_heading_center(doc, "DEDICATION")
    add_para(
        doc,
        f"This project is dedicated to Almighty God for His guidance and protection "
        f"throughout my studies, and to my beloved family, especially {DEDICATION_FAMILY}, "
        f"for their endless support, encouragement, and sacrifices.",
    )
    page_break(doc)


def acknowledgement(doc):
    add_heading_center(doc, "ACKNOWLEDGEMENT")
    add_para(
        doc,
        "I give all glory to Almighty God for the wisdom, strength, and grace to complete "
        "this project successfully.",
    )
    add_para(
        doc,
        f"My sincere gratitude goes to my supervisor, {SUPERVISOR}, for the guidance, "
        f"corrections, and patience that shaped this work. I also appreciate the Head of "
        f"Department, {HOD}, and all the lecturers in the Department of {DEPARTMENT} for "
        f"the knowledge they imparted to me.",
    )
    add_para(
        doc,
        f"I am deeply thankful to my parents and family for their financial and moral "
        f"support, and to my friends and colleagues, especially {FRIENDS}, for their "
        f"encouragement during this programme.",
    )
    add_para(
        doc,
        "Finally, I thank everyone who contributed in one way or another to the success "
        "of this project. May God bless you all.",
    )
    page_break(doc)


def abstract(doc):
    add_heading_center(doc, "ABSTRACT")
    add_para(
        doc,
        "Many organisations still record staff attendance using manual registers where "
        "employees sign in and out with pen and paper. This method is slow, prone to "
        "errors, difficult to compile into monthly reports, and open to abuse such as "
        "buddy punching, where one employee signs attendance for an absent colleague. "
        "This project presents the design and implementation of a computerised staff "
        "attendance system that authenticates staff using a Personal Identification "
        "Number (PIN) and photographic verification at a shared reception kiosk.",
    )
    add_para(
        doc,
        "In the proposed system, an employee selects their name, enters a four-digit "
        "PIN issued by the administrator, and captures a photograph before clocking in "
        "or out. Suspicious attempts — such as a missing photograph, a duplicate entry "
        "on the same day, or a staff member without a stored profile photograph — are "
        "sent to a review queue where the administrator manually compares the captured "
        "photograph with the stored profile photograph before approving or rejecting "
        "the record. The system also provides leave management, attendance reporting, "
        "and role-based portals for administrators and staff.",
    )
    add_para(
        doc,
        "The system was developed using Next.js, TypeScript and Tailwind CSS for the "
        "user interface, and Supabase (PostgreSQL, Authentication and Storage) for the "
        "backend. It was deployed as a web application and packaged as a Windows "
        "desktop application using Electron. Testing confirmed that the system records "
        "clock-in and clock-out events reliably, reduces unauthorised self check-in "
        "from personal devices, and produces useful attendance reports. The system is "
        "therefore an affordable alternative to expensive fingerprint hardware while "
        "still providing practical verification through PIN and photo evidence.",
    )
    page_break(doc)


def toc(doc):
    add_heading_center(doc, "TABLE OF CONTENTS")
    items = [
        "Title Page",
        "Certification",
        "Approval Page",
        "Dedication",
        "Acknowledgement",
        "Abstract",
        "Table of Contents",
        "List of Figures",
        "List of Tables",
        "",
        "CHAPTER ONE: INTRODUCTION",
        "1.1 Background of the Study",
        "1.2 Statement of the Problem",
        "1.3 Objectives of the Study",
        "1.4 Significance of the Study",
        "1.5 Scope of the Study",
        "1.6 Limitation of the Study",
        "1.7 Assumption of the Study",
        "1.8 Definition of Terms",
        "1.9 Thesis Organisation",
        "",
        "CHAPTER TWO: LITERATURE REVIEW",
        "2.1 Introduction",
        "2.2 Concept of Staff Attendance",
        "2.3 Manual Attendance System",
        "2.4 Existing Automated Systems",
        "2.5 Fingerprint Attendance Systems",
        "2.6 Card and RFID Systems",
        "2.7 Web and Mobile Attendance Systems",
        "2.8 Gaps in Existing Systems",
        "2.9 Summary",
        "",
        "CHAPTER THREE: METHODOLOGY AND ANALYSIS OF THE SYSTEM",
        "3.1 Introduction",
        "3.2 Methodology Adopted",
        "3.3 Fact Finding Methods Used",
        "3.4 Analysis of the Existing System",
        "3.5 Problems of the Existing System",
        "3.6 Analysis of the Proposed System",
        "3.7 Advantages of the Proposed System",
        "3.8 System Requirements",
        "3.9 Feasibility Study",
        "",
        "CHAPTER FOUR: DESIGN AND IMPLEMENTATION OF THE NEW SYSTEM",
        "4.1 Design Standards",
        "4.2 System Architecture",
        "4.3 Output Specification and Design",
        "4.4 Input Design and Specification",
        "4.5 File / Database Design",
        "4.6 Procedure Chart / Design",
        "4.7 System Flowchart",
        "4.8 System Requirements for Implementation",
        "4.9 Program Description / Implementation",
        "4.10 System Testing",
        "4.11 System Security",
        "",
        "CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS",
        "5.1 Summary",
        "5.2 Conclusion",
        "5.3 Recommendations",
        "5.4 Suggestions for Further Work",
        "",
        "References",
        "Appendix A: Selected Source Code",
        "Appendix B: Screenshots",
    ]
    for item in items:
        add_para(doc, item, align="left", first_line=False, space_after=2)
    page_break(doc)
    add_heading_center(doc, "LIST OF FIGURES")
    for f in [
        "Figure 3.1 Waterfall Development Model",
        "Figure 4.1 System Architecture Diagram",
        "Figure 4.2 Entity Relationship Diagram",
        "Figure 4.3 Clocking Process Flowchart",
        "Figure 4.4 Login / Authentication Screen",
        "Figure 4.5 Administrator Dashboard",
        "Figure 4.6 Staff Management Screen",
        "Figure 4.7 Kiosk Clock-in Screen (Name, PIN, Photo)",
        "Figure 4.8 Review Queue Screen",
        "Figure 4.9 Attendance Report Screen",
    ]:
        add_para(doc, f, align="left", first_line=False, space_after=2)
    page_break(doc)
    add_heading_center(doc, "LIST OF TABLES")
    for t in [
        "Table 3.1 Functional Requirements",
        "Table 3.2 Hardware Requirements",
        "Table 3.3 Software Requirements",
        "Table 4.1 Profiles Table Structure",
        "Table 4.2 Attendance Records Table Structure",
        "Table 4.3 Review Queue Table Structure",
        "Table 4.4 Test Cases and Results",
    ]:
        add_para(doc, t, align="left", first_line=False, space_after=2)
    page_break(doc)


def chapter_one(doc):
    add_heading_center(doc, "CHAPTER ONE")
    add_heading_center(doc, "INTRODUCTION")
    add_para(
        doc,
        "This chapter presents the background of the study, statement of the problem, "
        "objectives, significance, scope, limitations, assumptions and definition of "
        "terms related to the design and implementation of a computerised staff "
        "attendance system using PIN and photo verification.",
    )

    add_heading_left(doc, "1.1 BACKGROUND OF THE STUDY")
    add_para(
        doc,
        "The operation of any organisation depends on the contribution of its staff. "
        "Attendance is the act of being present at a place of work during the required "
        "hours. Accurate attendance records are used for payroll, discipline, "
        "productivity measurement and general administration.",
    )
    add_para(
        doc,
        "For many years, organisations have relied on manual registers in which "
        "employees write their names, signatures and arrival times. Although this "
        "method is cheap, it is slow, error-prone and open to buddy punching. With the "
        "growth of information technology, computerised attendance systems have become "
        "preferable because they store data safely, generate reports quickly and reduce "
        "fraud.",
    )
    add_para(
        doc,
        "Fingerprint biometric systems are popular but expensive for small organisations. "
        "This project therefore implements an affordable computerised alternative: a "
        "shared reception kiosk where staff authenticate with a four-digit PIN and a "
        "captured photograph that administrators can review manually. The implemented "
        "system is called AttendPro.",
    )

    add_heading_left(doc, "1.2 STATEMENT OF THE PROBLEM")
    add_para(
        doc,
        "Organisations that use pen and paper attendance face several problems:",
    )
    for item in [
        "Buddy punching — one employee can sign in for another who is absent or late.",
        "Human error — wrong times, unreadable handwriting and skipped entries.",
        "Loss or damage of paper registers.",
        "Difficulty preparing monthly and yearly attendance summaries.",
        "Lack of real-time monitoring of who is present.",
        "High cost of fingerprint devices, which is not suitable for small organisations.",
    ]:
        add_para(doc, item, align="left", first_line=False)
    add_para(
        doc,
        "There is therefore a need for an affordable, reliable and secure computerised "
        "staff attendance system that does not depend on expensive fingerprint hardware.",
    )

    add_heading_left(doc, "1.3 OBJECTIVES OF THE STUDY")
    add_para(doc, "The aim of this project is to design and implement a computerised staff attendance system using PIN and photo verification.", first_line=False)
    add_para(doc, "The specific objectives are to:", first_line=False)
    for i, obj in enumerate(
        [
            "Develop a computerised staff attendance system that records clock-in and clock-out at a shared reception kiosk.",
            "Authenticate each staff member using a four-digit PIN issued by the administrator.",
            "Capture a photograph at the point of clocking for administrative verification.",
            "Provide a review queue where suspicious attempts are checked manually.",
            "Provide administrative modules for staff management, leave approval and attendance reporting.",
            "Deploy the system as a web application and as a Windows desktop application.",
        ],
        start=1,
    ):
        add_para(doc, f"{i}. {obj}", align="left", first_line=False)

    add_heading_left(doc, "1.4 SIGNIFICANCE OF THE STUDY")
    add_para(
        doc,
        "This study is significant because it reduces attendance fraud through the "
        "combination of a secret PIN and a photograph; saves time in recording and "
        "compiling attendance; improves accuracy by storing data in a database; is "
        "affordable compared with fingerprint hardware; supports management decisions "
        "with timely reports; and serves as a useful reference for future research.",
    )

    add_heading_left(doc, "1.5 SCOPE OF THE STUDY")
    for s in [
        "Recording of staff clock-in and clock-out at a shared kiosk using name, PIN and photograph.",
        "Administrative management of staff records, PINs and profile photographs.",
        "A review queue for manual verification of suspicious clocking attempts.",
        "Leave request and approval management.",
        "Attendance history and reporting with export.",
        "Multi-organisation support with role-based access.",
        f"Implementation context: {CASE_STUDY} (or a similar organisational setting).",
    ]:
        add_para(doc, s, align="left", first_line=False)

    add_heading_left(doc, "1.6 LIMITATION OF THE STUDY")
    for lim in [
        "Unavailability of some academic materials within the project period.",
        "Time constraint for extended field testing across many organisations.",
        "Financial constraint that prevented procurement of fingerprint devices.",
        "The system requires internet access to the online database.",
        "Photograph verification is manual (administrator review), not automatic face recognition.",
        "Staff do not clock in from personal phones; clocking is kiosk-only.",
    ]:
        add_para(doc, lim, align="left", first_line=False)

    add_heading_left(doc, "1.7 ASSUMPTION OF THE STUDY")
    add_para(
        doc,
        "It is assumed that all data collected for this study are correct and contain "
        "no false information; that the organisation will provide a stable internet "
        "connection at the reception point; and that administrators will keep staff "
        "PINs confidential and issue them only to the rightful owners.",
    )

    add_heading_left(doc, "1.8 DEFINITION OF TERMS")
    terms = {
        "Attendance": "The act of being present at work or an official event.",
        "Clock-in / Clock-out": "Recording the time of arrival / departure respectively.",
        "Kiosk": "A shared computer or tablet placed at reception for staff clocking.",
        "PIN": "A secret four-digit Personal Identification Number used for authentication.",
        "Buddy Punching": "Attendance fraud where one person clocks in for another.",
        "Administrator": "The person who manages staff, reports and system settings.",
        "Database": "An organised collection of data stored electronically.",
        "Web Application": "Software accessed through a web browser.",
        "Desktop Application": "Software installed and run on a personal computer.",
        "Review Queue": "A list of clocking attempts waiting for manual administrative decision.",
        "Hardware": "The physical parts of a computer system.",
        "Software": "Programs that control hardware and perform tasks.",
        "System": "A set of interrelated components working together to achieve a purpose.",
    }
    for k, v in terms.items():
        add_para(doc, f"{k}: {v}", align="left", first_line=False)

    add_heading_left(doc, "1.9 THESIS ORGANISATION")
    add_para(
        doc,
        "This project report is organised into five chapters. Chapter One introduces "
        "the study. Chapter Two reviews related literature and existing systems. "
        "Chapter Three presents the methodology and analysis of the existing and "
        "proposed systems. Chapter Four covers design, implementation and testing. "
        "Chapter Five presents the summary, conclusion and recommendations.",
    )
    page_break(doc)


def chapter_two(doc):
    add_heading_center(doc, "CHAPTER TWO")
    add_heading_center(doc, "LITERATURE REVIEW")
    add_heading_left(doc, "2.1 INTRODUCTION")
    add_para(
        doc,
        "This chapter reviews concepts and systems related to staff attendance "
        "management. It examines the manual method and automated approaches such as "
        "fingerprint, card/RFID and web-based systems, and identifies gaps that "
        "motivate the PIN and photo verification approach used in this project.",
    )
    add_heading_left(doc, "2.2 CONCEPT OF STAFF ATTENDANCE")
    add_para(
        doc,
        "Staff attendance tracking is a common practice in almost all organisations. "
        "It helps management maintain performance standards, compute working hours and "
        "enforce discipline. Attendance can be defined as the action of being present "
        "at a place or event, such as being present at work during official hours.",
    )
    add_heading_left(doc, "2.3 MANUAL ATTENDANCE SYSTEM")
    add_para(
        doc,
        "The traditional pen-and-paper register is still widely used, especially in "
        "small organisations. Employees write their names and times of arrival and "
        "departure. The method is inexpensive but difficult to manage when the number "
        "of staff is large, and it is easy for one person to write attendance for "
        "another.",
    )
    add_heading_left(doc, "2.4 EXISTING AUTOMATED SYSTEMS")
    add_para(
        doc,
        "Automated systems capture attendance electronically. Examples include client-"
        "server punch systems using barcodes, RFID/smart card systems, biometric "
        "fingerprint clocks, and web or mobile applications. Each approach has "
        "strengths and weaknesses in cost, convenience and security.",
    )
    add_heading_left(doc, "2.5 FINGERPRINT ATTENDANCE SYSTEMS")
    add_para(
        doc,
        "Fingerprint systems identify staff by comparing a live fingerprint with a "
        "stored template. They are reliable against buddy punching because fingerprints "
        "are difficult to share. However, fingerprint devices are relatively expensive, "
        "and scanners may fail for people with worn or dirty fingers. For small "
        "companies with few staff, purchasing fingerprint hardware may not be "
        "economically justified. This project therefore replaces fingerprint capture "
        "with PIN authentication plus photographic evidence for manual review.",
    )
    add_heading_left(doc, "2.6 CARD AND RFID SYSTEMS")
    add_para(
        doc,
        "Card and RFID systems are fast and cheaper than biometrics, but cards can be "
        "lost, forgotten or given to another person to tap. Therefore they do not fully "
        "prevent attendance fraud.",
    )
    add_heading_left(doc, "2.7 WEB AND MOBILE ATTENDANCE SYSTEMS")
    add_para(
        doc,
        "Web and mobile systems allow attendance through browsers or smartphones and "
        "make reporting easy. When employees clock in from personal phones, however, "
        "it is harder to confirm that the right person clocked in from the right place. "
        "This project restricts clocking to a shared reception kiosk to reduce that risk.",
    )
    add_heading_left(doc, "2.8 GAPS IN EXISTING SYSTEMS")
    for g in [
        "Fingerprint systems are accurate but costly for small organisations.",
        "Card/RFID systems do not fully stop card sharing.",
        "Mobile self check-in is convenient but difficult to trust.",
        "Many older systems store data only on a local PC, risking loss and limiting remote access.",
    ]:
        add_para(doc, g, align="left", first_line=False)
    add_heading_left(doc, "2.9 SUMMARY")
    add_para(
        doc,
        "The literature shows a trade-off between cost, convenience and security. This "
        "project addresses the gaps by combining a shared kiosk, a secret PIN and a "
        "captured photograph with administrative review, providing practical "
        "verification without expensive fingerprint hardware.",
    )
    page_break(doc)


def chapter_three(doc):
    add_heading_center(doc, "CHAPTER THREE")
    add_heading_center(doc, "METHODOLOGY AND ANALYSIS OF THE SYSTEM")
    add_heading_left(doc, "3.1 INTRODUCTION")
    add_para(
        doc,
        "This chapter describes the methodology used, the fact-finding methods, and "
        "the analysis of both the existing and proposed systems, including requirements "
        "and feasibility.",
    )
    add_heading_left(doc, "3.2 METHODOLOGY ADOPTED")
    add_para(
        doc,
        "The Waterfall Model of software development was adopted. Development proceeded "
        "stage by stage: requirements gathering, analysis, design, implementation, "
        "testing and maintenance. The Waterfall Model was suitable because the "
        "requirements of the attendance system were clear from the beginning.",
    )
    add_para(doc, "[INSERT FIGURE 3.1 — Waterfall Development Model]", align="center", first_line=False, bold=True)

    add_heading_left(doc, "3.3 FACT FINDING METHODS USED")
    add_para(doc, "Data were obtained from primary and secondary sources.", first_line=False)
    add_para(
        doc,
        "Primary source: observation of how manual attendance is taken, and interviews "
        "with staff and administrators concerning problems of the existing system.",
    )
    add_para(
        doc,
        "Secondary source: textbooks, journals, existing project reports and online "
        "documentation on attendance systems, web applications and database design.",
    )

    add_heading_left(doc, "3.4 ANALYSIS OF THE EXISTING SYSTEM")
    add_para(
        doc,
        "In the existing manual system, an attendance register is kept at the entrance "
        "or reception. Employees write their names, signatures and times of arrival and "
        "departure. At month end, an officer manually counts entries to prepare summaries "
        "for management and payroll. Leave records are often kept in separate files, "
        "making combined reporting difficult.",
    )

    add_heading_left(doc, "3.5 PROBLEMS OF THE EXISTING SYSTEM")
    for p in [
        "Buddy punching is easy.",
        "Handwriting may be unclear.",
        "Registers can be lost or damaged.",
        "Report compilation is slow.",
        "No real-time view of attendance.",
        "Leave and attendance are poorly integrated.",
    ]:
        add_para(doc, p, align="left", first_line=False)

    add_heading_left(doc, "3.6 ANALYSIS OF THE PROPOSED SYSTEM")
    add_para(
        doc,
        "The proposed system, AttendPro, is a computerised staff attendance system. "
        "The administrator registers each employee, assigns a four-digit PIN and uploads "
        "a profile photograph. At the kiosk, the employee selects a name, enters the PIN "
        "and captures a photograph. Valid attempts are recorded automatically. Suspicious "
        "attempts go to a review queue for manual comparison of photos. Staff can view "
        "attendance history and request leave; administrators manage staff, leave and "
        "reports.",
    )

    add_heading_left(doc, "3.7 ADVANTAGES OF THE PROPOSED SYSTEM")
    for a in [
        "Reduces buddy punching through PIN and photograph.",
        "Stores attendance safely in a cloud database.",
        "Generates reports quickly and supports export.",
        "Provides real-time attendance visibility.",
        "Integrates leave management.",
        "Uses ordinary camera-equipped devices instead of fingerprint machines.",
        "Runs as both web and Windows desktop applications.",
    ]:
        add_para(doc, a, align="left", first_line=False)

    add_heading_left(doc, "3.8 SYSTEM REQUIREMENTS")
    add_para(doc, "Table 3.1 — Functional Requirements", bold=True, align="left", first_line=False)
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "S/N"
    hdr[1].text = "Requirement"
    reqs = [
        "Administrator can add, edit, activate and deactivate staff.",
        "Administrator can set a four-digit PIN for each staff member.",
        "Profile photographs can be uploaded for staff.",
        "Staff can clock in/out with name, PIN and photograph at a kiosk.",
        "Suspicious attempts are placed in a review queue.",
        "Administrator can approve or reject review items.",
        "Staff can request leave; administrator can approve or reject.",
        "Attendance reports can be generated and exported.",
    ]
    for i, r in enumerate(reqs, 1):
        row = table.add_row().cells
        row[0].text = str(i)
        row[1].text = r
    add_para(doc, "", first_line=False)

    add_para(doc, "Table 3.2 — Hardware Requirements", bold=True, align="left", first_line=False)
    hw = doc.add_table(rows=1, cols=3)
    hw.style = "Table Grid"
    hw.rows[0].cells[0].text = "S/N"
    hw.rows[0].cells[1].text = "Component"
    hw.rows[0].cells[2].text = "Minimum Specification"
    for i, (c, s) in enumerate(
        [
            ("Processor", "Intel Core i3 or equivalent"),
            ("RAM", "4 GB (8 GB recommended)"),
            ("Storage", "500 GB HDD/SSD"),
            ("Camera", "Built-in or USB webcam for the kiosk"),
            ("Network", "Internet connection"),
            ("Display", "Monitor or tablet touchscreen"),
        ],
        1,
    ):
        row = hw.add_row().cells
        row[0].text = str(i)
        row[1].text = c
        row[2].text = s
    add_para(doc, "", first_line=False)

    add_para(doc, "Table 3.3 — Software Requirements", bold=True, align="left", first_line=False)
    sw = doc.add_table(rows=1, cols=3)
    sw.style = "Table Grid"
    sw.rows[0].cells[0].text = "S/N"
    sw.rows[0].cells[1].text = "Software"
    sw.rows[0].cells[2].text = "Purpose"
    for i, (c, s) in enumerate(
        [
            ("Windows 10/11", "Operating system"),
            ("Chrome / Edge", "Web client"),
            ("AttendPro Desktop", "Electron desktop client"),
            ("Supabase (PostgreSQL)", "Database, auth and storage"),
            ("Node.js / Next.js", "Application runtime"),
        ],
        1,
    ):
        row = sw.add_row().cells
        row[0].text = str(i)
        row[1].text = c
        row[2].text = s

    add_heading_left(doc, "3.9 FEASIBILITY STUDY")
    add_para(
        doc,
        "Technical feasibility: The system uses widely supported tools (Next.js and "
        "Supabase) and ordinary camera hardware, so it is technically feasible.",
    )
    add_para(
        doc,
        "Economic feasibility: Expensive fingerprint devices are avoided. Development "
        "and hosting can use free or low-cost tiers, so the system is economically "
        "feasible for small organisations.",
    )
    add_para(
        doc,
        "Operational feasibility: The clocking flow (select name, enter PIN, take photo) "
        "is simple and requires little training, so the system is operationally feasible.",
    )
    page_break(doc)


def chapter_four(doc):
    add_heading_center(doc, "CHAPTER FOUR")
    add_heading_center(doc, "DESIGN AND IMPLEMENTATION OF THE NEW SYSTEM")

    add_heading_left(doc, "4.1 DESIGN STANDARDS")
    for d in [
        "Design input formats that enable the administrator to register staff and set PINs.",
        "Design a kiosk interface for staff to select name, enter PIN and capture a photograph.",
        "Design outputs for attendance reports and review decisions.",
        "Structure a database to store staff, attendance, leave and review data.",
        "Design secure authentication and role-based menus for admin and staff.",
        "Design photo storage for profile photographs and kiosk captures.",
    ]:
        add_para(doc, d, align="left", first_line=False)

    add_heading_left(doc, "4.2 SYSTEM ARCHITECTURE")
    add_para(
        doc,
        "The system follows a client–server architecture. The client is the user "
        "interface running in a browser or Electron desktop window. The server side is "
        "provided by Supabase, which handles authentication, PostgreSQL storage and "
        "private file storage for photographs. Communication uses HTTPS over the internet.",
    )
    add_para(doc, "[INSERT FIGURE 4.1 — System Architecture Diagram]", align="center", first_line=False, bold=True)

    add_heading_left(doc, "4.3 OUTPUT SPECIFICATION AND DESIGN")
    add_para(
        doc,
        "Outputs include the administrator dashboard, attendance history tables, leave "
        "lists, review queue screens with side-by-side photographs, and exportable "
        "attendance reports. Outputs may be viewed on screen or exported for printing.",
    )

    add_heading_left(doc, "4.4 INPUT DESIGN AND SPECIFICATION")
    add_para(
        doc,
        "The major input forms are: Login form; Staff registration/edit form (including "
        "Employee ID and Kiosk PIN); Profile photo upload; Kiosk name selection; PIN "
        "entry; Photo capture; Leave request form; and Review approve/reject actions.",
    )

    add_heading_left(doc, "4.5 FILE / DATABASE DESIGN")
    add_para(
        doc,
        "PostgreSQL (via Supabase) was used. Important tables include profiles "
        "(staff details, hashed PIN, avatar path), attendance_records (clock events), "
        "review_queue (pending manual checks), leaves, organisations and kiosks.",
    )
    add_para(doc, "Table 4.1 — Profiles Table (summary)", bold=True, align="left", first_line=False)
    t1 = doc.add_table(rows=1, cols=3)
    t1.style = "Table Grid"
    t1.rows[0].cells[0].text = "Field"
    t1.rows[0].cells[1].text = "Type"
    t1.rows[0].cells[2].text = "Description"
    for f, ty, desc in [
        ("id", "UUID", "Primary key"),
        ("full_name", "Text", "Staff name"),
        ("email", "Text", "Login email"),
        ("department", "Text", "Department"),
        ("kiosk_pin_hash", "Text", "Hashed 4-digit PIN"),
        ("avatar_url", "Text", "Profile photo path"),
        ("role", "Text", "admin or staff"),
        ("is_active", "Boolean", "Account status"),
    ]:
        row = t1.add_row().cells
        row[0].text = f
        row[1].text = ty
        row[2].text = desc
    add_para(doc, "", first_line=False)
    add_para(doc, "Table 4.2 — Attendance Records (summary)", bold=True, align="left", first_line=False)
    t2 = doc.add_table(rows=1, cols=3)
    t2.style = "Table Grid"
    t2.rows[0].cells[0].text = "Field"
    t2.rows[0].cells[1].text = "Type"
    t2.rows[0].cells[2].text = "Description"
    for f, ty, desc in [
        ("id", "UUID", "Primary key"),
        ("staff_id", "UUID", "Staff who clocked"),
        ("type", "Text", "check_in or check_out"),
        ("server_timestamp", "Timestamp", "Time of event"),
        ("match_status", "Text", "auto_matched / manual_override"),
        ("photo_capture_url", "Text", "Kiosk photo path"),
        ("kiosk_device_id", "UUID", "Kiosk used"),
    ]:
        row = t2.add_row().cells
        row[0].text = f
        row[1].text = ty
        row[2].text = desc
    add_para(doc, "", first_line=False)
    add_para(doc, "[INSERT FIGURE 4.2 — Entity Relationship Diagram]", align="center", first_line=False, bold=True)

    add_heading_left(doc, "4.6 PROCEDURE CHART / DESIGN")
    add_para(
        doc,
        "The major procedures are: authenticate user; manage staff and PIN; "
        "authenticate kiosk device; process clock attempt (verify PIN, require photo, "
        "detect duplicates); enqueue review items; resolve review items; sync daily "
        "attendance summary; and generate reports.",
    )

    add_heading_left(doc, "4.7 SYSTEM FLOWCHART")
    add_para(
        doc,
        "Clocking flow: Start → Open kiosk → Select staff name → Enter PIN → If PIN "
        "invalid, reject → Capture photo → If no photo, send to review → If duplicate "
        "same day, send to review → If no profile photo on file, send to review → "
        "Otherwise record attendance → Show success → End. Review items are later "
        "approved or rejected by the administrator.",
    )
    add_para(doc, "[INSERT FIGURE 4.3 — Clocking Process Flowchart]", align="center", first_line=False, bold=True)

    add_heading_left(doc, "4.8 SYSTEM REQUIREMENTS FOR IMPLEMENTATION")
    add_para(
        doc,
        "Hardware: a PC or tablet with webcam and internet access. Software: Windows "
        "10/11, a modern browser, or the AttendPro desktop installer. Backend services: "
        "Supabase project with required migrations applied (including photo-kiosk and "
        "kiosk sync fixes).",
    )

    add_heading_left(doc, "4.9 PROGRAM DESCRIPTION / IMPLEMENTATION")
    add_para(
        doc,
        "The system was implemented as modules: Authentication; Staff management; "
        "Kiosk clocking (PIN + photo); Review queue; Leave management; Reporting; and "
        "Desktop packaging with Electron. PINs are stored as secure hashes, never as "
        "plain text. Photographs are stored in private storage buckets and accessed "
        "through signed URLs.",
    )
    for fig in [
        "[INSERT FIGURE 4.4 — Login Screen]",
        "[INSERT FIGURE 4.5 — Administrator Dashboard]",
        "[INSERT FIGURE 4.6 — Staff Management Screen]",
        "[INSERT FIGURE 4.7 — Kiosk Clock-in Screen]",
        "[INSERT FIGURE 4.8 — Review Queue Screen]",
        "[INSERT FIGURE 4.9 — Attendance Report Screen]",
    ]:
        add_para(doc, fig, align="center", first_line=False, bold=True)

    add_heading_left(doc, "4.10 SYSTEM TESTING")
    add_para(doc, "Table 4.4 — Test Cases and Results", bold=True, align="left", first_line=False)
    tt = doc.add_table(rows=1, cols=4)
    tt.style = "Table Grid"
    tt.rows[0].cells[0].text = "S/N"
    tt.rows[0].cells[1].text = "Test Case"
    tt.rows[0].cells[2].text = "Expected Result"
    tt.rows[0].cells[3].text = "Status"
    cases = [
        ("Login with correct details", "User logged in", "Passed"),
        ("Login with wrong password", "Access denied", "Passed"),
        ("Clock in with correct PIN and photo", "Attendance recorded", "Passed"),
        ("Clock in with wrong PIN", "Incorrect PIN message", "Passed"),
        ("Clock in without photo", "Sent to review queue", "Passed"),
        ("Duplicate clock same day", "Sent to review queue", "Passed"),
        ("Admin approves review item", "Attendance recorded", "Passed"),
        ("Staff leave request", "Saved as pending", "Passed"),
        ("Export attendance report", "Report downloaded", "Passed"),
    ]
    for i, (a, b, c) in enumerate(cases, 1):
        row = tt.add_row().cells
        row[0].text = str(i)
        row[1].text = a
        row[2].text = b
        row[3].text = c

    add_heading_left(doc, "4.11 SYSTEM SECURITY")
    for s in [
        "PIN hashing — PINs are not stored in plain text.",
        "Row Level Security — organisations only see their own data.",
        "Role-based access — only administrators manage staff and reports.",
        "Kiosk-only clocking — staff cannot self check-in from personal phones.",
        "Private photo storage with signed access links.",
        "HTTPS encryption for network communication.",
    ]:
        add_para(doc, s, align="left", first_line=False)
    page_break(doc)


def chapter_five(doc):
    add_heading_center(doc, "CHAPTER FIVE")
    add_heading_center(doc, "SUMMARY, CONCLUSION AND RECOMMENDATIONS")
    add_heading_left(doc, "5.1 SUMMARY")
    add_para(
        doc,
        "This project designed and implemented a computerised staff attendance system "
        "that replaces the manual register. Staff clock in and out at a reception kiosk "
        "using their name, a four-digit PIN and a photograph. Suspicious attempts go to "
        "a review queue for manual verification. The system also provides leave "
        "management and reporting, and was deployed as a web application and a Windows "
        "desktop application.",
    )
    add_heading_left(doc, "5.2 CONCLUSION")
    add_para(
        doc,
        "The objective of building a practical computerised attendance system without "
        "expensive fingerprint hardware was achieved. PIN and photo verification, "
        "combined with administrative review, provide a convenient and more secure "
        "method than pen-and-paper registers. The system is user friendly and suitable "
        "for schools, companies and similar organisations.",
    )
    add_heading_left(doc, "5.3 RECOMMENDATIONS")
    for r in [
        "Organisations should adopt computerised attendance systems to improve accuracy and reduce fraud.",
        "Administrators should keep staff PINs confidential and reset them when necessary.",
        "Every staff member should have a clear profile photograph on file.",
        "A stable internet connection should be provided at the reception kiosk.",
        "This academic work is recommended for institutions with similar organisational needs.",
    ]:
        add_para(doc, r, align="left", first_line=False)
    add_heading_left(doc, "5.4 SUGGESTIONS FOR FURTHER WORK")
    for s in [
        "Add automatic facial recognition to reduce manual review.",
        "Add a fuller offline mode with later synchronisation.",
        "Integrate payroll calculation from attendance records.",
        "Develop a controlled mobile application with stronger location checks.",
        "Add SMS or email alerts for lateness and absence.",
    ]:
        add_para(doc, s, align="left", first_line=False)
    page_break(doc)


def references(doc):
    add_heading_center(doc, "REFERENCES")
    refs = [
        "Date, C. J. (2004). An Introduction to Database Systems. Pearson Education.",
        "Laudon, K. C., & Laudon, J. P. (2020). Management Information Systems. Pearson.",
        "Pressman, R. S. (2014). Software Engineering: A Practitioner's Approach. McGraw-Hill.",
        "Somerville, I. (2016). Software Engineering. Pearson Education.",
        "Next.js Documentation. (2024). Next.js. Retrieved from https://nextjs.org/docs",
        "Supabase Documentation. (2024). Supabase. Retrieved from https://supabase.com/docs",
        "Electron Documentation. (2024). Electron. Retrieved from https://www.electronjs.org/docs",
        "O’Brien, J. A., & Marakas, G. M. (2011). Management Information Systems. McGraw-Hill.",
        "Stair, R., & Reynolds, G. (2018). Fundamentals of Information Systems. Cengage Learning.",
        "Akinyokun, O. C. (related works on computerised information systems in Nigeria). Journal / Conference references as applicable.",
    ]
    for r in refs:
        add_para(doc, r, align="left", first_line=False, space_after=6)
    page_break(doc)
    add_heading_center(doc, "APPENDIX A")
    add_heading_center(doc, "SELECTED SOURCE CODE")
    add_para(
        doc,
        "Paste selected source listings here (for example PIN verification and kiosk "
        "clock processing). Do not include secret keys or .env values.",
        first_line=False,
    )
    page_break(doc)
    add_heading_center(doc, "APPENDIX B")
    add_heading_center(doc, "SCREENSHOTS")
    add_para(
        doc,
        "Insert screenshots of the running system: login, dashboard, staff management, "
        "kiosk clock-in, review queue and reports.",
        first_line=False,
    )


def main():
    import os

    doc = setup_doc()
    title_page(doc)
    certification(doc)
    approval(doc)
    dedication(doc)
    acknowledgement(doc)
    abstract(doc)
    toc(doc)
    chapter_one(doc)
    chapter_two(doc)
    chapter_three(doc)
    chapter_four(doc)
    chapter_five(doc)
    references(doc)

    os.makedirs(os.path.dirname(OUTPUT2), exist_ok=True)
    doc.save(OUTPUT)
    doc.save(OUTPUT2)
    print("Saved:", OUTPUT)
    print("Saved:", OUTPUT2)


if __name__ == "__main__":
    main()
