# DESIGN AND IMPLEMENTATION OF A COMPUTERIZED EMPLOYEE CLOCKING SYSTEM

> **HOW TO USE THIS FILE**
> 1. Open this file, copy everything into Microsoft Word.
> 2. Replace every field written in `[SQUARE BRACKETS]` with your real details.
> 3. Apply formatting: Times New Roman, size 12, 1.5 line spacing, left margin 2 inches, other margins 1 inch. Justify body text.
> 4. Put each preliminary page and each chapter on its own page (Insert → Page Break).
> 5. Number preliminary pages with small Roman numerals (i, ii, iii...) and main chapters with normal numbers (1, 2, 3...).
> 6. Insert your screenshots where marked `[INSERT FIGURE ...]`.
> 7. Export as **PDF** for the softcopy, and print + bind for the hardcopy.

---

# PRELIMINARY PAGES

---

## TITLE PAGE

**DESIGN AND IMPLEMENTATION OF A COMPUTERIZED EMPLOYEE CLOCKING SYSTEM**

**(A CASE STUDY OF [NAME OF ORGANISATION / SCHOOL USED AS CASE STUDY])**

BY

**[YOUR FULL NAME]**

**[YOUR MATRICULATION / REGISTRATION NUMBER]**

A PROJECT SUBMITTED TO THE

DEPARTMENT OF [YOUR DEPARTMENT, e.g. COMPUTER SCIENCE]

SCHOOL OF [YOUR SCHOOL, e.g. APPLIED SCIENCES]

**[NAME OF YOUR POLYTECHNIC]**

IN PARTIAL FULFILMENT OF THE REQUIREMENTS FOR THE AWARD OF

**[HIGHER NATIONAL DIPLOMA (HND) / NATIONAL DIPLOMA (ND)]**

IN [YOUR PROGRAMME, e.g. COMPUTER SCIENCE]

**[MONTH, YEAR — e.g. AUGUST, 2026]**

---

## CERTIFICATION

This is to certify that this project titled **"Design and Implementation of a Computerized Employee Clocking System"** was carried out by **[YOUR FULL NAME]** with matriculation number **[YOUR MATRIC NUMBER]** in the Department of [YOUR DEPARTMENT], [NAME OF POLYTECHNIC], and has been read and approved as meeting the requirements for the award of the [HND/ND] in [YOUR PROGRAMME].

<br><br>

______________________________  &nbsp;&nbsp;&nbsp;&nbsp; ______________________________
**[SUPERVISOR'S NAME]**  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date
(Project Supervisor)

<br><br>

______________________________  &nbsp;&nbsp;&nbsp;&nbsp; ______________________________
**[HEAD OF DEPARTMENT'S NAME]**  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date
(Head of Department)

<br><br>

______________________________  &nbsp;&nbsp;&nbsp;&nbsp; ______________________________
**External Examiner**  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date

---

## APPROVAL PAGE

This project has been read and approved as meeting the requirements of the Department of [YOUR DEPARTMENT], [NAME OF POLYTECHNIC], for the award of the [HND/ND] in [YOUR PROGRAMME].

<br><br>

______________________________
**[YOUR FULL NAME]**
(Student)

<br><br>

______________________________
**[SUPERVISOR'S NAME]**
(Supervisor)

---

## DEDICATION

This project is dedicated to Almighty God for His guidance and protection throughout my studies, and to my beloved parents, **[PARENTS' / FAMILY NAMES]**, for their endless support, encouragement, and sacrifices.

---

## ACKNOWLEDGEMENTS

I give all glory to Almighty God for the wisdom, strength, and grace to complete this project successfully.

My sincere gratitude goes to my supervisor, **[SUPERVISOR'S NAME]**, for the guidance, corrections, and patience that shaped this work. I also appreciate the Head of Department, **[HOD'S NAME]**, and all the lecturers in the Department of [YOUR DEPARTMENT] for the knowledge they imparted to me.

I am deeply thankful to my parents and family for their financial and moral support, and to my friends and colleagues, especially **[NAMES OF FRIENDS/CLASSMATES]**, for their encouragement during this programme.

Finally, I thank everyone who contributed in one way or another to the success of this project. May God bless you all.

---

## ABSTRACT

Many organisations still record employee attendance using manual registers, where staff sign in and out with a pen and paper. This traditional method is slow, prone to errors, difficult to compile into reports, and open to abuse such as "buddy punching," where one employee signs in on behalf of an absent colleague. This project presents the design and implementation of a **Computerized Employee Clocking System** that automates the recording of staff attendance and leave management.

The proposed system uses a shared **reception kiosk** at which an employee selects their name, enters a **four-digit Personal Identification Number (PIN)** issued by the administrator, and captures a **photograph** with the device camera before clocking in or out. Suspicious attempts — such as a missing photo, a duplicate entry on the same day, or a staff member without a stored profile photo — are automatically sent to a **review queue**, where the administrator manually compares the captured photo with the employee's stored profile photo before approving or rejecting the record.

The system was developed using **Next.js**, **TypeScript**, and **Tailwind CSS** for the user interface, and **Supabase (PostgreSQL, Authentication, and Storage)** for the backend, with **Row Level Security** enforcing data isolation between organisations. It was deployed as a **web application** and also packaged as a **Windows desktop application** using Electron. Testing confirmed that the system records clock-in and clock-out events reliably, prevents self check-in from personal devices, and generates attendance reports that can be exported. The system reduces attendance fraud, saves time, and improves record keeping compared with the manual method.

---

## TABLE OF CONTENTS

```
Title Page ........................................................... i
Certification ........................................................ ii
Approval Page ........................................................ iii
Dedication ........................................................... iv
Acknowledgements ..................................................... v
Abstract ............................................................. vi
Table of Contents .................................................... vii
List of Figures ...................................................... viii
List of Tables ....................................................... ix

CHAPTER ONE: INTRODUCTION
1.1  Background of the Study ......................................... 1
1.2  Statement of the Problem ........................................ 2
1.3  Aim and Objectives of the Study ................................. 2
1.4  Significance of the Study ....................................... 3
1.5  Scope of the Study .............................................. 3
1.6  Limitations of the Study ........................................ 4
1.7  Definition of Terms ............................................. 4

CHAPTER TWO: LITERATURE REVIEW
2.1  Introduction .................................................... 6
2.2  Concept of Employee Attendance .................................. 6
2.3  The Manual Attendance System ................................... 7
2.4  Review of Existing Automated Systems ........................... 7
2.5  Biometric Attendance Systems ................................... 8
2.6  Card and RFID-Based Systems .................................... 9
2.7  Web and Mobile Attendance Systems .............................. 9
2.8  Gaps in Existing Systems ....................................... 10
2.9  Summary ........................................................ 10

CHAPTER THREE: SYSTEM ANALYSIS AND METHODOLOGY
3.1  Introduction ................................................... 11
3.2  Methodology Adopted ............................................ 11
3.3  Analysis of the Existing System ................................ 12
3.4  Problems of the Existing System ................................ 12
3.5  Analysis of the Proposed System ................................ 13
3.6  Advantages of the Proposed System .............................. 13
3.7  System Requirements ............................................ 14
3.8  Feasibility Study .............................................. 15

CHAPTER FOUR: SYSTEM DESIGN AND IMPLEMENTATION
4.1  Introduction ................................................... 16
4.2  System Architecture ............................................ 16
4.3  Database Design ................................................ 17
4.4  Input and Output Design ........................................ 19
4.5  Program / System Flowchart ..................................... 20
4.6  Choice of Development Tools .................................... 21
4.7  System Implementation .......................................... 22
4.8  System Testing ................................................. 24
4.9  System Requirements for Deployment ............................. 25
4.10 System Security ................................................ 25

CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS
5.1  Summary ........................................................ 27
5.2  Conclusion ..................................................... 27
5.3  Recommendations ................................................ 28
5.4  Suggestions for Further Work ................................... 28

References ........................................................... 29
Appendix A: Source Code Listing ...................................... 30
Appendix B: Screenshots .............................................. 35
```

---

## LIST OF FIGURES

```
Figure 3.1  Waterfall Development Model ............................. 11
Figure 4.1  System Architecture Diagram ............................ 16
Figure 4.2  Entity Relationship Diagram ............................ 18
Figure 4.3  System Flowchart (Clocking Process) .................... 20
Figure 4.4  Login / Authentication Screen .......................... 22
Figure 4.5  Administrator Dashboard ................................ 22
Figure 4.6  Staff Management Screen ................................ 23
Figure 4.7  Kiosk Clock-in Screen (Name, PIN, Photo) ............... 23
Figure 4.8  Review Queue Screen .................................... 24
Figure 4.9  Attendance Report Screen ............................... 24
```

## LIST OF TABLES

```
Table 3.1  Functional Requirements ................................. 14
Table 3.2  Hardware Requirements ................................... 14
Table 3.3  Software Requirements ................................... 15
Table 4.1  Profiles Table Structure ............................... 18
Table 4.2  Attendance Records Table Structure ..................... 18
Table 4.3  Review Queue Table Structure ........................... 19
Table 4.4  Test Cases and Results ................................. 24
```

---

# CHAPTER ONE: INTRODUCTION

## 1.1 Background of the Study

Attendance management is one of the most important administrative activities in any organisation. It is the process of recording the time an employee arrives at work (clock-in) and the time the employee leaves (clock-out). This information is used to monitor punctuality, calculate working hours, process salaries, and evaluate staff performance.

For many years, organisations have relied on the **manual method** of attendance, in which a paper register or attendance book is placed at the entrance and each employee signs beside their name with the time of arrival. Although this method is cheap and simple, it has several weaknesses. The records can be lost or damaged, the handwriting may be difficult to read, and it is very easy for one employee to sign in for another who is absent or late. Compiling monthly attendance summaries from paper records is also slow and tiring.

With the growth of information and communication technology, organisations now prefer **computerized attendance systems** that record data automatically, store it safely in a database, and generate reports instantly. A computerized employee clocking system reduces human error, saves time, prevents attendance fraud, and provides accurate data for management decisions.

This project focuses on the design and implementation of such a system, named **AttendPro**. The system allows employees to clock in and out at a shared reception device using their name, a secret four-digit PIN issued by the administrator, and a photograph captured at the point of clocking. The photograph gives the administrator visual evidence that the correct person clocked in, without requiring expensive biometric hardware such as fingerprint or facial-recognition scanners.

## 1.2 Statement of the Problem

The manual attendance system used in many organisations suffers from the following problems:

1. **Attendance fraud (buddy punching):** An employee can easily sign in for a colleague who is absent or late.
2. **Human error:** Wrong times, unreadable handwriting, and skipped entries are common.
3. **Loss of records:** Paper registers can be lost, torn, stolen, or damaged by water or fire.
4. **Difficulty in reporting:** Preparing monthly or yearly attendance summaries by hand is slow and error-prone.
5. **No real-time monitoring:** Management cannot see who is present at any given moment without physically checking the register.
6. **High cost of biometric alternatives:** Fingerprint and facial-recognition devices are effective but expensive to buy and maintain, which is a challenge for small organisations.

There is therefore a need for an affordable, reliable, and secure computerized system that solves these problems.

## 1.3 Aim and Objectives of the Study

**Aim:** The aim of this project is to design and implement a computerized employee clocking system that records staff attendance accurately and reduces attendance fraud.

**Objectives:** The specific objectives are to:

1. Design a system that allows employees to clock in and out at a shared reception kiosk.
2. Authenticate each employee using a four-digit PIN issued by the administrator.
3. Capture a photograph at the point of clocking for administrative verification.
4. Provide a review queue where suspicious attempts are checked manually by the administrator.
5. Provide an administrative module for managing staff records, attendance, and leave requests.
6. Generate attendance reports that can be viewed and exported.
7. Deploy the system as both a web application and a Windows desktop application.

## 1.4 Significance of the Study

This study is significant because it:

1. **Reduces attendance fraud** by combining a secret PIN with a photograph at the point of clocking.
2. **Saves time and effort** in recording and compiling attendance data.
3. **Improves accuracy and record keeping** by storing data safely in a database.
4. **Is affordable** because it uses ordinary devices with a camera instead of expensive biometric scanners.
5. **Supports management decisions** by providing accurate, timely attendance and leave reports.
6. **Serves as a reference** for students and researchers who wish to build on the work in the future.

## 1.5 Scope of the Study

This project covers the design and implementation of a computerized employee clocking system with the following features:

- Employee clock-in and clock-out at a shared reception kiosk using name, PIN, and photograph.
- Administrative management of staff records (add, edit, activate, deactivate).
- Setting of employee PINs and upload of employee profile photographs.
- A review queue for manual verification of suspicious clocking attempts.
- Leave request and approval management.
- Attendance history and reporting with export.
- Multi-organisation support with separate data for each organisation.
- Deployment as a web application and a Windows desktop application.

## 1.6 Limitations of the Study

1. The system requires an **internet connection** to reach the online database for authentication and data storage.
2. Verification of the captured photograph is done **manually by the administrator**; the system does not perform automatic facial recognition.
3. Employees do **not** clock in from their personal phones; clocking is restricted to the shared kiosk to reduce fraud.
4. The PIN is issued by the administrator and communicated to the employee outside the system.

## 1.7 Definition of Terms

- **Clocking:** The act of recording the time an employee arrives at or leaves work.
- **Clock-in / Clock-out:** Recording arrival time / departure time respectively.
- **Kiosk:** A shared computer or tablet placed at the reception where employees clock in and out.
- **PIN (Personal Identification Number):** A secret four-digit number used to confirm an employee's identity.
- **Buddy Punching:** A form of attendance fraud where one employee clocks in for another.
- **Administrator (Admin):** The person who manages the system, staff records, and reports.
- **Database:** An organised collection of data stored electronically.
- **Web Application:** A software program that runs in a web browser.
- **Desktop Application:** A software program installed and run on a computer.
- **Review Queue:** A list of clocking attempts that require manual checking by the administrator.

---

# CHAPTER TWO: LITERATURE REVIEW

## 2.1 Introduction

This chapter reviews existing literature and systems related to employee attendance and clocking. It examines the concept of attendance management, the traditional manual method, and various automated methods such as biometric, card-based, and web-based systems. The chapter also identifies the gaps in existing systems that this project aims to address.

## 2.2 Concept of Employee Attendance

Employee attendance refers to the presence of workers at their place of duty during official working hours. Accurate attendance data is essential for payroll processing, discipline, productivity measurement, and general administration. According to management studies, organisations that monitor attendance effectively tend to record higher productivity and lower absenteeism. Attendance management therefore forms a core part of human resource management.

## 2.3 The Manual Attendance System

The manual attendance system is the oldest and most widely used method, especially in small organisations and schools. It typically involves a bound register or an attendance sheet where employees write their names, signatures, and arrival times. While it is inexpensive and requires no technical skill, researchers have consistently pointed out its weaknesses: it is time-consuming, easily manipulated, difficult to analyse, and vulnerable to loss or damage. These weaknesses have motivated the shift towards automated systems.

## 2.4 Review of Existing Automated Systems

Automated attendance systems capture and store attendance data electronically. They generally fall into three categories: biometric systems, card/RFID systems, and web/mobile systems. Each is discussed below.

## 2.5 Biometric Attendance Systems

Biometric systems identify employees using unique body features such as fingerprints, facial features, or the iris. When an employee places a finger on a scanner or looks into a camera, the system compares the captured feature with a stored template and records attendance if it matches.

**Strengths:** High accuracy and strong protection against buddy punching, since biometric features cannot easily be shared.

**Weaknesses:** The hardware is relatively expensive; fingerprint scanners may fail for people with worn or dirty fingers; and facial-recognition systems require good lighting and considerable processing power. These costs and requirements make biometric systems difficult for small organisations to adopt.

## 2.6 Card and RFID-Based Systems

In card-based and Radio Frequency Identification (RFID) systems, each employee is given a card that is swiped or tapped on a reader to record attendance.

**Strengths:** Fast and easy to use; cheaper than biometrics.

**Weaknesses:** Cards can be lost, forgotten, or given to another person to swipe, so they do not fully prevent buddy punching. They also require the purchase and management of cards and readers.

## 2.7 Web and Mobile Attendance Systems

Web and mobile systems allow employees to clock in through a website or a smartphone application, sometimes combined with location (GPS) checks or a photograph.

**Strengths:** Accessible from many devices; easy to generate reports; no special hardware beyond a normal computer or phone.

**Weaknesses:** When employees clock in from personal phones, it is difficult to be sure that the right person clocked in from the right place, which reintroduces the risk of fraud. Pure GPS checks can be faked with location-spoofing tools.

## 2.8 Gaps in Existing Systems

From the review above, the following gaps are observed:

1. Biometric systems are accurate but **expensive** for small organisations.
2. Card/RFID systems are cheap but **do not stop card sharing**.
3. Mobile self check-in is convenient but **hard to trust** when done from personal devices.
4. Many systems store data locally, making it **vulnerable to loss** and hard to access remotely.

## 2.9 Summary

The reviewed systems show a trade-off between cost, convenience, and security. This project addresses the identified gaps by combining a **shared kiosk**, a **secret PIN**, and a **captured photograph** with **manual administrative review**. This approach provides reasonable security against buddy punching at low cost, stores data safely in a cloud database, and allows attendance from a controlled reception point rather than personal devices.

---

# CHAPTER THREE: SYSTEM ANALYSIS AND METHODOLOGY

## 3.1 Introduction

This chapter describes how the existing system was studied and how the new system was designed. It presents the methodology adopted, the analysis of both the existing and proposed systems, the system requirements, and the feasibility study.

## 3.2 Methodology Adopted

The **Waterfall Model** of software development was adopted for this project. The Waterfall Model is a step-by-step approach in which each stage is completed before the next begins. The stages are: **Requirements gathering, System analysis, System design, Implementation (coding), Testing, and Maintenance.** This model was chosen because the requirements of the attendance system were clear and well understood from the beginning, which suits the orderly, stage-by-stage nature of the Waterfall approach.

**[INSERT FIGURE 3.1 — Waterfall Development Model diagram]**

Information for the study was gathered through **observation** of how manual attendance is taken, **interviews** with staff and administrators, and **study of existing systems and literature**.

## 3.3 Analysis of the Existing System

In the existing (manual) system, an attendance register is kept at the reception or entrance. On arrival, each employee writes their name, signature, and time of arrival, and repeats the process on departure. At the end of each month, an administrative officer manually counts the entries to determine how many days each employee was present, absent, or late, and prepares a summary for management and payroll.

## 3.4 Problems of the Existing System

1. It is easy for one employee to sign in for another (buddy punching).
2. Handwriting may be unclear, leading to wrong records.
3. Registers can be lost or damaged.
4. Compiling reports is slow and tiring.
5. There is no way to view attendance in real time.
6. Leave records are kept separately and are difficult to combine with attendance.

## 3.5 Analysis of the Proposed System

The proposed system, **AttendPro**, is a computerized employee clocking system. Its main operations are:

1. The administrator registers each employee, assigns a four-digit PIN, and uploads a profile photograph.
2. At the reception kiosk, an employee **selects their name** from a list, **enters their PIN**, and **captures a photograph**.
3. If the PIN is correct and a photograph is captured, the system records a **clock-in** or **clock-out** automatically.
4. If there is a problem — a missing photograph, a duplicate entry for the same day, or a staff member with no stored profile photograph — the attempt is placed in a **review queue** for the administrator to check manually.
5. The administrator compares the captured photograph with the stored profile photograph and **approves** or **rejects** the record.
6. Employees can log in to a portal to view their attendance history and to request leave.
7. The administrator can view a dashboard, manage staff and leave, and generate attendance reports.

## 3.6 Advantages of the Proposed System

1. Reduces buddy punching through the combination of PIN and photograph.
2. Records data accurately and stores it safely in a cloud database.
3. Generates reports quickly and allows export.
4. Provides real-time monitoring of attendance.
5. Combines attendance and leave management in one system.
6. Is affordable, using ordinary camera-equipped devices.
7. Runs as both a web application and a desktop application.

## 3.7 System Requirements

**Table 3.1 — Functional Requirements**

| S/N | Requirement |
|-----|-------------|
| 1 | The system shall allow the administrator to add, edit, activate, and deactivate staff. |
| 2 | The system shall allow the administrator to set a four-digit PIN for each staff member. |
| 3 | The system shall allow upload of a profile photograph for each staff member. |
| 4 | The system shall allow employees to clock in/out with name, PIN, and photograph at a kiosk. |
| 5 | The system shall place suspicious attempts in a review queue. |
| 6 | The system shall allow the administrator to approve or reject review items. |
| 7 | The system shall allow employees to request leave and administrators to approve/reject it. |
| 8 | The system shall generate and export attendance reports. |

**Table 3.2 — Hardware Requirements**

| S/N | Component | Minimum Specification |
|-----|-----------|-----------------------|
| 1 | Processor | Intel Core i3 or equivalent |
| 2 | Memory (RAM) | 4 GB (8 GB recommended) |
| 3 | Storage | 500 GB HDD / SSD |
| 4 | Camera | Built-in or USB webcam (for the kiosk) |
| 5 | Network | Internet connection |
| 6 | Display | Standard monitor or tablet touchscreen |

**Table 3.3 — Software Requirements**

| S/N | Software | Purpose |
|-----|----------|---------|
| 1 | Windows 10/11 or any modern OS | Operating system |
| 2 | Web browser (Chrome/Edge) | Running the web application |
| 3 | AttendPro Desktop (Electron) | Running the desktop application |
| 4 | Supabase (PostgreSQL) | Online database, authentication, storage |
| 5 | Node.js / Next.js runtime | Application server (bundled in desktop build) |

## 3.8 Feasibility Study

- **Technical feasibility:** The system was built with widely available and well-supported technologies (Next.js, Supabase). No special hardware is required beyond a camera-equipped device, so the system is technically feasible.
- **Economic feasibility:** The system avoids expensive biometric hardware and uses free/low-cost development tools and hosting tiers, making it economically feasible for small organisations.
- **Operational feasibility:** The interface is simple — select name, enter PIN, take a photo — so staff can use it with little training, making it operationally feasible.

---

# CHAPTER FOUR: SYSTEM DESIGN AND IMPLEMENTATION

## 4.1 Introduction

This chapter presents the design of the new system, including its architecture, database structure, input and output design, and flowcharts. It also describes the tools used, how the system was implemented, and how it was tested.

## 4.2 System Architecture

The system follows a **client–server architecture**. The client is the user interface that runs in a web browser or in the desktop application window. The server side is provided by Supabase, which handles authentication, the PostgreSQL database, and file (photograph) storage. Communication between the client and the server takes place over the internet.

```
+---------------------------+        +--------------------------------+
|        CLIENT             |        |           SERVER               |
|  (Browser / Desktop App)  | <----> |          (Supabase)            |
|                           |  HTTPS |                                |
|  - Kiosk clocking screen  |        |  - Authentication              |
|  - Admin dashboard        |        |  - PostgreSQL database         |
|  - Staff portal           |        |  - File storage (photos)       |
|  - Review queue           |        |  - Row Level Security (RLS)    |
+---------------------------+        +--------------------------------+
```

**[INSERT FIGURE 4.1 — System Architecture Diagram]**

## 4.3 Database Design

The database was designed using the relational model and implemented in PostgreSQL (through Supabase). The main tables are described below.

**Table 4.1 — Profiles (Staff) Table**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | Organisation the staff belongs to |
| full_name | Text | Staff full name |
| email | Text | Login email |
| department | Text | Department |
| employee_code | Text | Employee ID |
| role | Text | admin or staff |
| kiosk_pin_hash | Text | Hashed four-digit PIN |
| avatar_url | Text | Path to profile photograph |
| is_active | Boolean | Whether the account is active |
| date_joined | Date | Date employed |

**Table 4.2 — Attendance Records Table**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | Organisation |
| staff_id | UUID | Staff who clocked |
| type | Text | check_in or check_out |
| server_timestamp | Timestamp | Time of clocking |
| match_status | Text | auto_matched or manual_override |
| photo_capture_url | Text | Path to the captured photograph |
| kiosk_device_id | UUID | Kiosk used |

**Table 4.3 — Review Queue Table**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| staff_id | UUID | Staff involved |
| attempt_type | Text | check_in or check_out |
| reason | Text | missing_photo, duplicate_day, photo_review |
| status | Text | pending, approved, rejected |
| live_capture_url | Text | Photograph taken at the kiosk |
| stored_reference_url | Text | Stored profile photograph |
| reviewed_by | UUID | Administrator who resolved it |

**[INSERT FIGURE 4.2 — Entity Relationship Diagram]**

## 4.4 Input and Output Design

**Input design** covers the screens where data is entered, such as the login form, the staff registration form (name, email, department, PIN, photo), and the kiosk clocking screen (name, PIN, photo capture).

**Output design** covers the screens that display information, such as the administrator dashboard, the attendance history table, the review queue, and the exportable attendance report.

## 4.5 Program / System Flowchart

The flowchart below describes the clocking process.

```
            START
              |
     Open Kiosk Screen
              |
      Select Staff Name
              |
        Enter 4-digit PIN
              |
        Is PIN correct? ----No----> Show "Incorrect PIN" ---> END
              | Yes
        Capture Photograph
              |
     Photo captured? ----No----> Send to Review Queue
              | Yes                        |
   Duplicate for today? --Yes--> Send to Review Queue
              | No                         |
  Profile photo on file? --No--> Send to Review Queue
              | Yes                        |
      Record Clock-in/out                  |
              |                            |
        Show Success            Admin reviews & decides
              |                            |
             END <------------------------- 
```

**[INSERT FIGURE 4.3 — System Flowchart]**

## 4.6 Choice of Development Tools

- **Next.js (React) and TypeScript:** For building the user interface and server logic.
- **Tailwind CSS:** For styling the interface.
- **Supabase:** For authentication, PostgreSQL database, and file storage.
- **Electron:** For packaging the application as a Windows desktop program.
- **Vercel:** For hosting the web version.
- **Visual Studio Code / Cursor:** As the code editor.
- **Git and GitHub:** For version control and source-code storage.

These tools were chosen because they are modern, well documented, widely used in industry, and available at little or no cost.

## 4.7 System Implementation

The system was implemented as a collection of modules:

1. **Authentication module:** Handles registration of organisations, login, and logout. Each user has a role (administrator or staff).
2. **Staff management module:** Allows the administrator to add, edit, activate, or deactivate staff, set the four-digit PIN, and upload a profile photograph.
3. **Kiosk clocking module:** Presents the reception screen where an employee selects a name, enters a PIN, and captures a photograph to clock in or out.
4. **Review queue module:** Collects attempts that need manual checking and lets the administrator compare the captured photograph with the stored profile photograph before approving or rejecting.
5. **Leave management module:** Allows staff to request leave and administrators to approve or reject requests.
6. **Reporting module:** Displays attendance summaries and allows export.

The PIN is never stored in plain text; it is converted into a secure **hash** before being saved, so that even the database does not reveal the actual PIN.

**[INSERT FIGURE 4.4 — Login Screen]**
**[INSERT FIGURE 4.5 — Administrator Dashboard]**
**[INSERT FIGURE 4.6 — Staff Management Screen]**
**[INSERT FIGURE 4.7 — Kiosk Clock-in Screen]**
**[INSERT FIGURE 4.8 — Review Queue Screen]**
**[INSERT FIGURE 4.9 — Attendance Report Screen]**

## 4.8 System Testing

The system was tested using **unit testing** (testing individual parts), **integration testing** (testing parts working together), and **system testing** (testing the whole system). The table below shows sample test cases.

**Table 4.4 — Test Cases and Results**

| S/N | Test Case | Expected Result | Actual Result | Status |
|-----|-----------|-----------------|---------------|--------|
| 1 | Login with correct details | User is logged in | User logged in | Passed |
| 2 | Login with wrong password | Access denied | Access denied | Passed |
| 3 | Clock in with correct PIN and photo | Attendance recorded | Attendance recorded | Passed |
| 4 | Clock in with wrong PIN | "Incorrect PIN" message | Message shown | Passed |
| 5 | Clock in without photo | Sent to review queue | Sent to review queue | Passed |
| 6 | Clock in twice same day | Sent to review queue | Sent to review queue | Passed |
| 7 | Admin approves review item | Attendance recorded | Attendance recorded | Passed |
| 8 | Staff requests leave | Request saved as pending | Request saved | Passed |
| 9 | Export attendance report | Report downloaded | Report downloaded | Passed |

## 4.9 System Requirements for Deployment

The web version is hosted online and accessed through a browser. The desktop version is installed on a Windows computer using the **AttendPro-Setup-1.0.0.exe** installer produced by the project. After installation, a configuration file containing the database connection keys is placed in the application data folder, and the program is launched from the Start Menu. An internet connection is required for the system to reach the online database.

## 4.10 System Security

The following security measures were implemented:

1. **PIN hashing:** PINs are stored as secure hashes, not as plain numbers.
2. **Row Level Security (RLS):** Each organisation can only see its own data.
3. **Role-based access:** Only administrators can manage staff and reports.
4. **Restricted clocking:** Staff cannot clock in from personal phones; only the shared kiosk is used.
5. **Private photograph storage:** Photographs are stored privately and viewed only through secure, time-limited links.
6. **Secure connections:** All communication uses HTTPS encryption.

---

# CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS

## 5.1 Summary

This project designed and implemented a computerized employee clocking system that replaces the manual attendance register. In the new system, an employee clocks in or out at a shared reception kiosk by selecting their name, entering a four-digit PIN issued by the administrator, and capturing a photograph. Suspicious attempts are sent to a review queue for manual verification by the administrator, who compares the captured photograph with a stored profile photograph. The system also provides staff and administrative portals, leave management, and attendance reporting. It was developed using Next.js, TypeScript, and Supabase, and deployed as both a web application and a Windows desktop application. Testing showed that the system met its objectives.

## 5.2 Conclusion

The manual attendance method is slow, error-prone, and open to fraud. The computerized employee clocking system developed in this project solves these problems by automating attendance recording, adding PIN and photograph verification to reduce buddy punching, storing data safely in a cloud database, and generating reports quickly. The system is affordable because it does not require expensive biometric hardware. It therefore provides a practical and reliable solution for small and medium-sized organisations.

## 5.3 Recommendations

1. Organisations should adopt computerized clocking systems to improve accuracy and reduce attendance fraud.
2. Administrators should keep employee PINs confidential and update them when necessary.
3. Every employee should have a clear profile photograph on file to make administrative verification easier.
4. A stable internet connection should be provided at the reception point where the kiosk is used.

## 5.4 Suggestions for Further Work

1. Add **automatic facial recognition** to reduce the need for manual review.
2. Add an **offline mode** with a local database that synchronises when the internet returns.
3. Integrate the system with a **payroll module** to calculate salaries automatically from attendance.
4. Develop a **mobile application** version with controlled location checks.
5. Add **SMS or email notifications** for lateness and absence.

---

## REFERENCES

> Format these using your school's referencing style (usually APA). Replace with the actual sources you read. Examples of the style:

1. Author, A. (Year). *Title of book*. Publisher.
2. Author, B., & Author, C. (Year). Title of journal article. *Name of Journal*, Volume(Issue), pages.
3. Author, D. (Year). *Title of online article/website*. Retrieved from URL.
4. Next.js Documentation. (Year). *Next.js*. Retrieved from https://nextjs.org/docs
5. Supabase Documentation. (Year). *Supabase*. Retrieved from https://supabase.com/docs

---

## APPENDIX A: SOURCE CODE LISTING

> Paste selected, important parts of your source code here (for example, the clocking logic and the PIN verification). Do not paste passwords or secret keys.

## APPENDIX B: SCREENSHOTS

> Paste full-page screenshots of the running system here: login, dashboard, staff management, kiosk clock-in, review queue, and reports.
