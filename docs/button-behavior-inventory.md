# FUZI Portal Button And Field Behavior Inventory

Source of truth for user-visible buttons, pressable rows/cards, dropdown options, and form fields in `expo-app/src/App.tsx`.

This inventory is intentionally broad. Many FUZI controls are generated from arrays or records, so they are listed as dynamic button families when the exact label is data-driven.

## Shared Rules

| Control class | Expected behavior | No-op prevention |
| --- | --- | --- |
| Module/navigation tiles | Switch the active module. | Target module state refs must be updated before mount when the target depends on local page state. |
| Pressable rows/cards | Navigate, filter, select, or open the record promised by the card. | If the record lacks an ID/link, show a visible message instead of silently returning. |
| Disclosure/dropdown buttons | Open or close the hidden section/list. | Chevron/label must change and hidden content must appear in the same scroll context. |
| Dropdown options | Select the option and close or update the visible draft/filter. | Selection must update the draft ref before any displayed state update. |
| Save/create/update buttons | Validate, call the API, refresh/cache as needed. | Missing required fields or IDs must call `setMessage(...)`. |
| Delete/remove buttons | Ask for confirmation before destructive changes. | Cancel must leave data unchanged; missing IDs must show a message. |
| Export/download/template/file buttons | Start a file open/download/upload/export. | API, file, auth, or cancel failure must show a message when actionable. |
| Status/action buttons | Patch the record status or related fields. | Missing record/config/location/assignee must show a message. |
| Show more/show less | Change local list limit only. | Disabled state prevents impossible increments/decrements. |
| Copy buttons | Copy text to clipboard. | Empty text must show a message instead of silently returning. |

## Global, Login, Header

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Back to website home | Leave `/portal` and open the website home. | Login |
| Sign in / Signing in... | Authenticate staff portal user. | Login |
| Login department dropdown | Toggle department list. | Login |
| Login department options | Select department and filter staff logins. | Login |
| Login user dropdown | Toggle staff login list. | Login |
| Login user options | Select username and clear password. | Login |
| Retry | Reload portal data from loading/error state. | Portal loading |
| Logout | End staff session and return to login/home. | Header/login |
| English / Hindi | Switch portal language. | Header |
| Global search result row | Open matching record/module and clear search. | Header |
| Global search Close | Clear/close global search. | Header |
| Comfort view / Compact view | Toggle list/card density. | Header |
| Inbox | Toggle notification center. | Header |
| Open Dept Comms | Navigate to Dept Comms. | Notification panel |
| Mark all read | Mark unread notifications as read. | Notification panel |
| Refresh | Reload portal data without changing module. | Header |

## Navigation

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Sidebar module item | Open module represented by the item. | Navigation |
| Top tab item | Open module represented by the item. | Navigation |
| Current module selector | Toggle module picker. | Navigation |
| Mobile module search | Filter module picker. | Navigation |
| Mobile module item | Open selected module and close picker. | Navigation |
| Today | Open Today action queue. | Navigation |
| Command Intelligence | Open intelligence dashboard. | Navigation |
| Operations Backlog | Open backlog. | Navigation |
| Overview | Open analytics overview. | Navigation |
| Platform Modules | Open generic module launcher. | Navigation |
| Dept Comms | Open department communications. | Navigation |
| Enquiries | Open CRM Enquiries view. | Navigation |
| Customers | Open CRM Customers view. | Navigation |
| Offer Manager | Open offer/customer offer manager. | Navigation |
| Marketing Platform | Open marketing assets. | Navigation |
| Site Visits | Open site visit reports. | Navigation |
| Costing Import | Open costing workbook import. | Navigation |
| Project Tickets | Open project tickets. | Navigation |
| Projects | Open department/project board. | Navigation |
| Installations | Open installation lifecycle. | Navigation |
| Install Team | Open install team board. | Navigation |
| Accounts / Team Accounts | Open staff account admin. | Navigation |
| Renewals | Open maintenance renewals. | Navigation |
| Work Orders | Open service/work orders. | Navigation |
| Inventory | Open warehouse inventory. | Navigation |
| Estimator | Open costing estimator. | Navigation |
| Org chart | Open org chart/team hierarchy. | Navigation |
| Sales | Open sales intake. | Navigation |
| Installation Dept | Open installation department. | Navigation |
| Breakdown Portal | Open breakdown portal. | Navigation |
| Service | Open service module. | Navigation |
| Finance | Open finance/payment ledger. | Navigation |
| Commissioning | Open commissioning board. | Navigation |
| Backoffice | Open backoffice/intelligence tools. | Navigation |
| Tender | Open tender dashboard. | Navigation |
| Factory | Open factory/workshop area. | Navigation |
| International Vendor | Open vendor partner pipeline. | Navigation |
| Approvals | Open approval workflow. | Navigation |
| Documents | Open document vault. | Navigation |
| Engineer Jobs | Open engineer job view. | Navigation |

## Shared List, Linked Record, And Generic Module Controls

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| show more | Increase visible rows for that list. | Shared lists |
| show less | Decrease visible rows for that list. | Shared lists |
| Open CRM | Search/open linked customer in Customers. | Linked panels |
| Site visits | Search/open linked site visits. | Linked panels |
| Start | Mark generic module record `In Progress`. | Platform modules |
| Close | Mark generic module record `Closed` or close modal depending context. | Shared/module |
| Dynamic status pills | Patch generic module record to selected status. | Platform modules |
| Department move buttons | Move customer/project card to selected department. | Projects |
| Log 1h | Log one hour against the department/project card. | Projects |
| Save module record | Save generic module record from draft refs. | Platform modules |
| Add / update module data | Open or focus generic module add/update form. | Platform modules |
| Add a customer first | Navigate/focus CRM customer creation when the empty-state action is shown. | Platform modules/CRM |

## Overview, Today, Projects

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Current fiscal year | Reset overview dates to fiscal range. | Overview |
| Attention/analytics cards | Navigate to linked module. | Overview |
| Emergency access / Open Breakdown Portal | Navigate to Breakdown Portal. | Overview |
| Today job cards | Navigate to job module and set search/filter. | Today |
| My assigned services cards | Open assigned service/breakdown/customer work. | Today |
| Check in to office | Mark current staff office check-in. | Today/service |
| Check out | Mark current staff office check-out. | Today/service |
| Open Customer CRM | Navigate to Customers from assignment/help panels. | Today/service |

## Costing Import, Estimator, Offers, Finance

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Refresh source data | Load costing workbook source data. | Costing Import |
| Previous source | Select previous workbook source. | Costing Import |
| Next source | Select next workbook source. | Costing Import |
| Previous data step | Move to previous workbook cell chunk. | Costing Import |
| Next data step | Move to next workbook cell chunk. | Costing Import |
| Stage for next offer | Copy selected costing source into offer draft. | Costing Import |
| Select ledger | Pick estimate/ledger for finance payment. | Finance |
| View report | Open estimate/report artifact. | Estimator |
| Open forecast | Open payment/collection forecast source. | Finance/intelligence |
| Send | Trigger estimate/offer send action. | Estimator |
| Approve costing / Approve | Approve estimate/offer. | Estimator/offer |
| Delete | Delete estimate after confirmation. | Estimator |
| Add payment | Save payment milestone from finance draft. | Finance |
| Add payment milestone | Open/focus payment milestone entry. | Finance |
| Auto-schedule | Generate payment schedule from selected estimate. | Finance |
| Save account payment | Save customer account payment. | Finance |
| Auto-schedule offer | Generate offer payment schedule. | Finance |
| Paid | Mark payment paid. | Finance |
| Overdue | Mark payment overdue. | Finance |
| Remind +N | Schedule next payment reminder interval. | Finance |
| Start New Offer / Start offer | Open offer editor for CRM/customer. | Offers |
| Use site visit measurement | Copy site visit measurement into offer. | Offers |
| Add inventory item to offer | Add selected inventory line to offer. | Offers |
| Remove | Remove offer inventory line. | Offers |
| Cancel | Close offer/costing/site-visit modal without saving. | Modals |
| Save offer | Persist offer draft. | Offers |
| Open costing | Open costing report/source. | Offer rows |
| Open letter | Open offer PDF/letter. | Offer rows |
| CRM customer | Open CRM customer or start/update CRM-linked offer/site-visit. | Offer rows |
| Update site visit / Add site visit | Open site visit editor from offer/customer context. | Offer rows |

## CRM, Customers, Enquiries, Site Visits

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Download CRM data | Export CRM data. | CRM |
| Send occasion reminders | Trigger reminder handoff. | CRM |
| CSV import Open/Close | Toggle CSV import panel. | CRM |
| Auto detect / Customer master / Customers / Sales enquiries / Site visits / Service history | Select CSV import type. | CRM import |
| Upload CSV | Open file picker and import selected CSV. | CRM import |
| Template download buttons | Download/import template for selected CRM import type. | CRM import |
| Add new CRM account / lead | Expand customer create form. | CRM |
| New account / lead | Same customer create disclosure when rendered as a section action. | CRM |
| Save customer | Save new or inline customer edit. | CRM |
| Add new sales enquiry | Expand sales enquiry form. | CRM |
| Every 3d / Every 7d / Every 14d / Every 30d | Set follow-up cadence and next follow-up. | CRM/Sales |
| Save enquiry intake | Save new enquiry. | CRM/Sales |
| Update enquiry record | Save edited enquiry. | CRM |
| Cancel enquiry edit | Clear edited enquiry state. | CRM |
| Enquiries / Customers | Switch CRM list view and active tab. | CRM |
| Department / Team / Pipeline stage dropdowns | Toggle/select CRM filters. | CRM |
| Team / position | Toggle/select CRM team-position filter. | CRM |
| Mark followed up | Mark follow-up completed. | CRM |
| +3d / +7d / +14d / +30d | Schedule follow-up date. | CRM |
| Close follow-up | Close follow-up status. | CRM |
| Customer record card | Open/select linked CRM/customer details when pressable. | CRM |
| Edit | Open inline customer/enquiry/tender/etc. editor depending row. | Multiple |
| Edit customer inline | Open inline customer editor. | CRM |
| New site visit | Open site visit modal for customer/enquiry. | CRM |
| Add site report | Open site visit editor from enquiry/customer. | CRM |
| Remove | Remove customer/enquiry/line after confirmation when destructive. | CRM/offer |
| Cancel edit | Close inline editor and discard draft. | CRM/tender |
| Convert to customer | Convert enquiry into customer. | CRM |
| Followed up | Mark enquiry followed-up. | CRM |
| Save to system | Save edited imported enquiry into system/customer workflow. | CRM |
| Site Visit | Patch enquiry status to Site Visit. | CRM/Sales |
| Offer Pending | Patch enquiry status to Offer Pending. | CRM/Sales |
| Offer Submitted | Patch enquiry status to Offer Submitted. | CRM/Sales |
| Lost | Patch enquiry/customer/vendor/renewal/tender status to Lost in the current module. | Multiple |
| Start new visit | Open site visit editor for selected CRM customer. | Site Visits |
| Add a new site visit record | Open/focus site visit creation flow. | Site Visits |
| Edit this visit | Load saved site visit into editor. | Site Visits |
| New follow-up visit | Create follow-up visit from saved visit/customer. | Site Visits |
| Update site visit report / Save site visit report | Persist site visit report. | Site Visits |
| Close | Close site visit/offer/global panel depending context. | Multiple |

## Service, Work Orders, Breakdown

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Check in | Capture service/breakdown visit check-in location/time. | Service/breakdown |
| Check out | Capture service/breakdown visit check-out location/time. | Service/breakdown |
| Service assignment row | Open assigned service/breakdown job. | Service |
| Team Accounts | Navigate to account admin. | Service |
| Reset assignments | Rebuild service assignments from team roster. | Service |
| Assign nearest | Assign nearest service to engineer. | Service |
| Assign Staff | Open/focus staff assignment controls. | Service/projects |
| Assign to engineer | Toggle assignment dropdown. | Service/breakdown |
| Unassign engineer | Clear engineer assignment. | Service |
| Engineer option | Assign selected engineer. | Service/breakdown |
| Select CRM customer | Toggle CRM customer dropdown. | Service/breakdown |
| Customer option | Populate service/breakdown draft. | Service/breakdown |
| Select customer | Toggle/select customer for the current draft. | Service/breakdown/renewals |
| Use install-date default | Apply service date/number from install date. | Service |
| Issue category / Common elevator issue / Other | Select issue category. | Service/breakdown |
| Create service record | Save new service record. | Service |
| Clear | Clear service search/form/task depending context. | Multiple |
| +N yr | Extend customer service years. | Service |
| Year dropdown | Toggle/select service year. | Service |
| Slot dropdown | Toggle/select service slot. | Service |
| Use system engineer | Apply default engineer from selected service slot. | Service |
| Save service record | Save inline service edit. | Service |
| Cancel | Cancel inline edit/modal. | Multiple |
| Open CRM customer | Navigate to linked CRM customer. | Service |
| Sync Discord | Import/sync OpenClaw breakdown confirmations. | Breakdown |
| Schedule Engineer | Toggle breakdown engineer schedule/roster. | Breakdown |
| Assign job | Assign install/team/staff job from row action. | Install Team/service |
| Save task | Save engineer task text. | Breakdown |
| Clear task | Clear engineer task. | Breakdown |
| Log breakdown | Save new breakdown call. | Breakdown |
| Breakdown filter buttons | Switch current/history/all breakdown view. | Breakdown |
| Repair notes | Toggle repair-note editor. | Breakdown |
| Select issue / issue option | Pick repair issue. | Breakdown |
| Save repair notes | Save repair details. | Breakdown |
| Engineer call/assignment row | Assign/call selected engineer. | Breakdown |
| Dispatch | Mark breakdown dispatched. | Breakdown |
| Reached site | Mark engineer reached site. | Breakdown |
| Close | Close breakdown or generic panel. | Breakdown |
| Available / Busy | Filter or display engineer availability; when pressable, assign/filter roster. | Breakdown |

## Installation, Install Team, Commissioning

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| New installation from CRM / Edit installation | Toggle installation editor. | Installation |
| Installation customer option | Populate install draft from CRM customer. | Installation |
| Create installation / Update installation | Persist installation job. | Installation |
| Cancel edit | Clear installation edit and return to create mode. | Installation |
| Installation status filters | Filter installation records. | Installation |
| Export CSV | Export installation report. | Installation |
| Approve | Approve installation/marketing/approval item depending context. | Multiple |
| Site Ready | Patch install status. | Installation |
| Material Ready | Patch install status. | Installation |
| Installation Assigned | Patch install status. | Installation |
| Under Installation | Patch install status. | Installation |
| Commissioning | Patch install status. | Installation |
| Handover Pending | Patch install status. | Installation |
| Completed | Patch install/tender status. | Multiple |
| Closed | Patch status closed. | Multiple |
| Send commissioning | Create/update commissioning handoff. | Installation |
| Save team member | Save install team member. | Install Team |
| Add team member | Open/focus install team member form. | Install Team |
| Assign to job / job assignment buttons | Assign team member to install job. | Install Team |
| Available | Mark install team member available. | Install Team |
| On Site | Mark install team member on site. | Install Team |
| Off Duty | Mark install team member off duty. | Install Team |
| Send to commissioning | Send install job to commissioning. | Install Team |
| Save commissioning record | Save commissioning record. | Commissioning |
| Commissioning engineer option | Assign commissioning engineer. | Commissioning |
| Closed loop | Patch commissioning controller loop. | Commissioning |
| Open loop | Patch commissioning controller loop. | Commissioning |
| Serial link | Patch commissioning communication. | Commissioning |
| Normal | Patch commissioning technical status. | Commissioning |
| Protocol yes | Mark protocol required/yes. | Commissioning |
| Protocol no | Mark protocol not required/no. | Commissioning |
| Upload motor nameplate | Open file picker/upload. | Commissioning |
| View nameplate | Open uploaded nameplate file. | Commissioning |
| Start checks | Start commissioning checks. | Commissioning |
| Payment cleared | Mark payment cleared. | Commissioning |
| Handover complete | Mark commissioning handover complete. | Commissioning |

## Staff, Accounts, Attendance, Leave

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Request time off | Save leave request. | HR |
| Staff/person option | Populate attendance/leave draft. | HR |
| Save attendance | Persist attendance row. | HR |
| Approve | Approve leave/approval item. | HR/Approvals |
| Reject | Reject leave/approval item. | HR/Approvals |
| Make primary | Mark selected org/account item primary. | Org/accounts |
| Remove | Remove selected item after confirmation when destructive. | Multiple |
| Generate password | Fill generated account password. | Accounts |
| Copy password | Copy account password from draft ref. | Accounts |
| Save account | Save inline account edit. | Accounts |
| New account / Hide form | Toggle create account form. | Accounts |
| Create new team account | Open account creation form. | Accounts |
| Sync all staff logins | Sync staff logins from staff records. | Accounts |
| Create account | Create new user account. | Accounts |
| Prepare login | Populate/create login draft from staff profile. | Accounts |
| Edit username / password | Open inline account/password editor. | Accounts |
| Reset staff password | Reset account to shared staff password policy. | Accounts |
| Restore to team / Remove from team | Toggle account active/team status. | Accounts |
| Change password | Save explicit password for row account. | Accounts |
| Generate | Generate row password. | Accounts |
| Copy | Copy row password. | Accounts |

## Intelligence, Backoffice, Approvals, Documents, Backlog

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Critical / High / Normal | Set escalation priority. | Intelligence |
| Save escalation rule | Save escalation rule. | Intelligence |
| Load template | Load matching conversation/template data. | Intelligence |
| Save conversation | Save conversation inbox item. | Intelligence |
| Offer version card | Open offer version comparison. | Intelligence |
| Installation milestone card | Open installation milestone tracker. | Intelligence |
| Save warranty | Save warranty record. | Intelligence |
| Save dispatch | Save dispatch record. | Intelligence |
| Save readiness | Save readiness checklist. | Intelligence |
| Save skills | Save engineer skill record. | Intelligence |
| Repeat complaint card | Open breakdown/customer source. | Intelligence |
| AMC calendar card | Open renewals/customer source. | Intelligence |
| Customer portal card | Open customer portal/customer source. | Intelligence |
| Customer portal action queue card | Open/review portal action. | Intelligence |
| Profitability card | Open offer/customer profitability source. | Intelligence |
| Save handover pack | Save digital handover pack. | Intelligence |
| Save lift asset | Save lift asset record. | Intelligence |
| Save parts usage | Save spare-parts usage record. | Intelligence |
| Inventory planning card | Open inventory planning source. | Intelligence |
| QR/service link card | Open linked service/customer item. | Intelligence |
| Save service report | Save service report. | Intelligence |
| Payment forecast card | Open finance/payment forecast source. | Intelligence |
| Save safety incident | Save safety incident. | Intelligence |
| Save tender checklist | Save tender checklist. | Intelligence |
| Save AMC contract | Save AMC contract. | Intelligence |
| Save daily brief | Save management daily brief. | Intelligence |
| Print / Save PDF | Open browser print/save flow. | Intelligence |
| Backlog category/filter buttons | Filter backlog by category/department/status. | Backlog |
| Backlog item card | Open or inspect backlog item. | Backlog |
| Request approval | Save new approval request. | Approvals |
| Approval item Approve / Reject | Patch approval item status. | Approvals |
| Upload file | Upload vault document. | Documents |
| Save link | Save document metadata/link. | Documents |
| Open document | Open document URL/data. | Documents |
| Engineer job row | Open linked engineer job. | Engineer Jobs |

## Renewals, Tender, International Vendor, Marketing

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Save renewal | Save renewal draft. | Renewals |
| Mark contacted | Patch renewal contacted. | Renewals |
| Renewed | Patch renewal renewed. | Renewals |
| Tender product type buttons | Set tender product type. | Tender |
| Save tender / Update tender | Save tender draft. | Tender |
| Tender status filters | Filter tender list. | Tender |
| Edit tender | Populate tender draft from row. | Tender |
| Tender Submitted | Patch tender status. | Tender |
| Tender Opened | Patch tender status. | Tender |
| Tender Lost | Patch tender status. | Tender |
| Order Pending | Patch tender status. | Tender |
| Work In Progress | Patch tender status. | Tender |
| EMD Returned | Patch tender status. | Tender |
| SD Refunded | Patch tender status. | Tender |
| Vendor row/stage selector | Select/edit vendor stage row. | International Vendor |
| Save international vendor | Save international vendor draft. | International Vendor |
| Vendor filter/status buttons | Filter vendor pipeline. | International Vendor |
| Move next | Move vendor to next pipeline stage. | International Vendor |
| Draft catalog intro | Fill vendor outreach brief. | International Vendor |
| Draft tender pitch | Fill vendor outreach brief. | International Vendor |
| OpenClaw draft | Send vendor outreach prompt. | International Vendor |
| Draft meeting email | Fill/send meeting request prompt. | International Vendor |
| Bid follow-up | Fill/send bid support follow-up. | International Vendor |
| Mark replied | Mark vendor replied. | International Vendor |
| Meeting booked | Mark meeting booked. | International Vendor |
| PO requested | Mark purchase order requested. | International Vendor |
| Plan production | Mark production planned. | International Vendor |
| Docs ready | Mark export docs ready. | International Vendor |
| Book freight | Mark freight booked. | International Vendor |
| Shipped | Mark shipped. | International Vendor |
| Delivered | Mark delivered. | International Vendor |
| Partner active | Mark partner active. | International Vendor |
| Build image prompt | Populate marketing AI image prompt. | Marketing |
| Build ad copy brief | Populate marketing ad copy brief. | Marketing |
| Build catalog brief | Populate catalog brief. | Marketing |
| Save marketing asset | Save marketing asset. | Marketing |
| Save & generate image | Save asset and request image generation. | Marketing |
| Save & draft ad copy | Save asset and request ad copy. | Marketing |
| Save & draft catalog | Save asset and request catalog. | Marketing |
| Generate ad image | Request image generation for saved asset. | Marketing |
| Draft ad copy | Request ad copy for saved asset. | Marketing |
| Draft catalog | Request catalog for saved asset. | Marketing |
| Approve marketing asset | Mark asset approved. | Marketing |

## Inventory

| Button/pressable | Expected behavior | Source area |
| --- | --- | --- |
| Offer selector pill | Link inventory draft to offer/customer. | Inventory |
| Save warehouse item | Save inventory item. | Inventory |
| Open CRM | Open linked customer in CRM. | Inventory |
| Open offers | Navigate to Offer Manager. | Inventory |
| Save stock/pricing | Patch stock thresholds/prices from row edit refs. | Inventory |
| Receive +1 | Increase stock by one. | Inventory |
| Issue -1 | Decrease stock by one. | Inventory |
| Order missing | Raise purchase order for reorder quantity. | Inventory |

## Accepted Non-Actions

These are intentionally allowed to do nothing:

- Canceling a browser file picker.
- Clicking a disabled button where the disabled state matches an impossible action.
- Pressing show less when already at the minimum visible count.
- Pressing show more when all rows are already visible.
- Dismissing a destructive confirmation dialog.

## Field And Text Input Behavior Inventory

Fields follow the same rule as buttons: typing must update the nearest draft ref immediately, and buttons that save/copy/submit must read that ref instead of an old render snapshot. State is only for displayed filters, currently visible labels, opened panels, or controls where the list must visibly change while typing.

| Area | Fields typed | Expected behavior after typing |
| --- | --- | --- |
| Login | Username, password | Text appears immediately and Sign in reads the typed credentials. |
| Global header | Module search, global search | Search/filter panels update locally without remounting the active module. |
| Overview | Start date, end date | Date filters update the overview boundary only. |
| Costing Import | List step input | Ref-backed list controller changes visible row count only. |
| CRM customer create | Customer, phone, address, department, GST, notes, handover date | Draft ref updates while typing; Save customer remains clickable and validates from the ref. |
| CRM sales enquiry create/edit | Enquiry no, customer, phone, status, follow-up fields, handover date, remark | Draft ref updates while typing; Save enquiry / Save to system stays clickable and validates from the ref. |
| CRM inline customer edit | Row edit fields and installed date | Row draft ref updates while typing; Save customer reads the row draft ref. |
| Site visit modal/report editor | Site visit fields, stops/openings, opening schedule rows | Draft ref updates immediately; Save site visit reads `siteVisitDraftRef.current`. |
| Service create/edit | Schedule date, parts, quantity, status, action, comments, inline edit rows | Draft refs update immediately; Create/Save reads service draft refs. |
| Breakdown create/repair/schedule | Customer-dependent fields, engineer task text, repair notes, schedule time | Draft refs update immediately; Save/Clear/repair actions read breakdown refs. |
| Installation/report filters | Installation draft fields, contractor/technical/upload fields, report dates | Draft refs update immediately; Create/Update validates on press from refs. |
| Install team / commissioning | Member fields, commissioning technical fields | Draft refs update immediately; Save buttons read refs. |
| Staff/account admin | Account form fields, inline account edits, password fields | Draft refs update immediately; Copy password and Save account read `accountStateRef.current`. |
| Attendance/leave | Attendance and leave fields | Draft refs update immediately; Save validates on press from refs rather than a stale disabled state. |
| Renewals | Customer-linked renewal fields | Draft refs update immediately; Save renewal validates from the ref. |
| Inventory | Warehouse item fields, stock/pricing inline edits | Draft refs update immediately; Save stock/pricing reads refs. |
| International vendor | Vendor profile, tender, communication, pricing, notes | Draft refs update immediately; Save/vendor stage buttons read refs. |
| Marketing | Asset metadata, ad copy, prompts, catalog/design fields | Marketing draft ref updates immediately; save/generate buttons read the ref. |
| Sales standalone | Enquiry intake fields | Sales draft ref updates immediately; Save enquiry intake validates from the ref. |
| Tender | Tender draft fields | Tender draft ref updates immediately; Save/Update tender reads the ref. |
| Offer/estimator | Offer header, payment terms, measurement fields, inventory lines | Offer draft ref updates immediately; save/costing actions read `offerDraftRef.current`. |

## Extraction Coverage Notes

This file was rebuilt against the current `App.tsx` pressable extraction. It covers:

- Hard-coded text buttons such as `Refresh`, `Save customer`, `Sync Discord`, `Order missing`, and `Upload file`.
- Dynamic status arrays such as tender statuses, installation statuses, sales inquiry statuses, CRM filters, and vendor pipeline stages.
- Data-driven pressable rows/cards such as module nav items, global search results, customer cards, job rows, intelligence cards, and inventory/offer selectors.
- Disclosure controls rendered through shared wrappers such as `LocalDisclosure`, `LocalToggle`, dropdown buttons, and chevrons.
