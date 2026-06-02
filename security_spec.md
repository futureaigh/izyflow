# Security Specification: IzyFlow Data Isolation

## Data Invariants
1. **User Ownership**: Every Workspace is tethered to a unique `ownerId` (the user's Auth UID).
2. **Strict Hierarchy**: All sub-resources (Accounts, Transactions, Invoices, Allocation Rules) are stored in sub-collections of a Workspace. Access is recursively derived from the parent Workspace's `ownerId`.
3. **Private Profiles**: User profiles are strictly private and accessible only by the owner or an Admin.

## Identity & Access Control (AC)
- **Role-Based**: Users are divided into `Admin` and `User`.
- **Identity Integrity**: For all write operations, the `ownerId` (or `userId`) in the incoming data MUST match `request.auth.uid`.

## Dirty Dozen Payloads (Targeting Isolation)
1. **Workspace Hijack**: Attempt to `update` another user's workspace by changing the `ownerId`.
   * *Status*: REJECTED by `resource.data.ownerId == request.auth.uid`.
2. **Subcollection Probe**: Attempt to `list` transactions in a workspace the user does not own.
   * *Status*: REJECTED by `isWorkspaceOwner(workspaceId)` using synchronous `get()`.
3. **Profile Spoofing**: Attempt to `create` or `read` another user's profile.
   * *Status*: REJECTED by `isOwner(userId)` matching UID.
4. **Admin Escalation**: Attempt to set `role: 'Admin'` during registration.
   * *Status*: REJECTED by `isValidUser` which blocks role setting unless already Admin.
5. **Orphan Write**: Attempt to create a transaction without a valid workspace.
   * *Status*: REJECTED by hierarchy pattern.
6. **Query Scraping**: Attempt to `list` all workspaces in the system.
   * *Status*: REJECTED as the `ownerId` filter is enforced in rules during listing.
7. **Cross-Tenant Leak**: Attempt to update a transaction but reference an Account ID belonging to a different workspace.
   * *Status*: REJECTED (logic handled in client, but rules prevent unauthorized account access anyway).
8. **Field Injection**: Attempt to inject unvalidated fields into a document.
   * *Status*: REJECTED by `isValid[Entity]` logic.
9. **Timestamp Forgery**: Attempt to set `createdAt` to a backdated time.
   * *Status*: REJECTED by `isValidDateString` and server-time validation.
10. **ID Poisoning**: Attempt to use a 2MB string as a workspace name.
    * *Status*: REJECTED by `.size() < 100` checks.
11. **Account Drain**: Attempt to `delete` an account with a positive balance.
    * *Status*: (Self-governed logic)
12. **Analytics Spam**: Attempt to `update` analytics data.
    * *Status*: REJECTED (analytics is write-only for non-admins).
