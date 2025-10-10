A.1.9.2 - Executive Process Definition [Section] <!-- UUID: 03d32549-1da5-4a9c-902f-196641370eaf -->

This Section defines the Executive Process, which is the end-to-end process through which Sky makes changes to the Sky Protocol.

#### A.1.9.2.1 - Definitions [Core] <!-- UUID: 324f379a-6341-4f39-aad5-f79f0d56812c -->

The documents herein contain common definitions that are relevant to the entirety of the Executive Process.

##### A.1.9.2.1.1 - Executive Sheet [Core] <!-- UUID: af04619b-5b0b-4762-86de-067550e079b9 -->

The Executive Sheet serves as a planning instrument and documentation for the agreed content of the Spell. It is therefore one of the foundational documents in the Executive Process. Each Spell has a dedicated Executive Sheet. The Governance Point creates a new Executive Sheet for each Executive Vote cycle, listing every executive item intended for inclusion in that cycle along with the provenance of each item. In this way, the Executive Sheet helps ensure transparency and verification in the Executive Process. Past Executive Sheets are preserved in order to provide a record of Executive Votes and their provenance.

The Executive Sheet \(also referred to as the “exec sheet” or “sheet”\) is maintained on a large Google Sheets spreadsheet with several tabs. Each Executive Vote has its own tab, whose title is the designated Target Date for each spell.

The Executive Sheet provides a publicly visible list of plain-English instructions outlining the executive actions performed in a given spell. Each executive action is populated in the Executive Sheet under a column and broken down into input actions \(high-level actions\) and derived actions \(resulting from input actions\).

The Executive Sheet is used by several actors in the Executive Process. It is managed and populated by the Governance Point, used by stakeholders, who are required to provide confirmation for proposed executive items, and by the Spell Team. The Executive Sheet is the source of truth for the Spell Crafter who crafts the Spell based on its content. Only the Core Facilitators have write access to the Executive Sheet.

##### A.1.9.2.1.2 - Target Date [Core] <!-- UUID: 2f06dd6a-8664-4916-8f82-5155d703d61a -->

The Target Date refers to the planned date when the Spell is expected to be made available to be voted on. The Target Date is decided by the Governance Point in collaboration with the Spell Crafter. Spells are usually deployed following a two-week cadence. Normally, the Target Date falls on Thursdays.

##### A.1.9.2.1.3 - Executive Document [Core] <!-- UUID: a352b5e8-752e-48f8-a393-cf5df5ae523d -->

The Executive Document \(also referred to as the "Executive Copy," "executive,” "Executive Proposal," or "exec doc"\) is a formal, plain-English Markdown document that serves as the primary communication tool for presenting the contents of an Executive Vote to the community. Created after the Executive Sheet is finalized, it provides a detailed breakdown of the actions proposed in the Executive Vote. Unlike the Executive Sheet, which organizes actions in a cell-based format, the Executive Document expresses these actions in sentence format for improved readability.

Each Executive Document corresponds to a specific spell and describes the actions that the spell will perform if executed. It is a critical tool for ensuring transparency, clarity, and alignment among stakeholders. The document serves as a proposal that can be voted on and either approved or rejected by Sky Governance. The Core Facilitators are responsible for producing and finalizing the Executive Document; and any changes must be made by them.

The Executive Document is designed to be accessible to both technical and non-technical members of the Sky Ecosystem. It enables Aligned Delegates and SKY holders to understand the actions that will be executed when the spell is cast. Its contents are publicly visible on the Voting Portal, where Aligned Delegates review it before voting on the spell. In addition to serving as a reference for voters, the Executive Document also guides the Spell Team in developing and finalizing the Spell, ensuring that the proposed actions are accurately implemented. The contents of the Executive Document are hashed and included within the Spell code to provide an additional layer of verification.

##### A.1.9.2.1.4 - Executive Vote [Core] <!-- UUID: c0aea3f8-4ed9-4bd6-928b-f43ccc7d5ecf -->

Executive Vote refers to the voting process of approving governance proposals within Sky Governance. These votes are conducted onchain and are used to implement technical changes to the Sky Protocol. For an Executive Vote to be executed, it must accumulate more SKY token support than any other active proposal, including the current leading proposal, ensuring it reflects the highest level of community backing at the time of approval.

##### A.1.9.2.1.5 - Sky Governance Voting Portal [Core] <!-- UUID: 0919d4bd-2050-43dc-a1b9-8cdfdf0cba54 -->

The Voting Portal is the primary user interface where Executive Votes are published and where Aligned Delegates and SKY holders review and vote on proposals. It serves as the canonical location for viewing active and past Executive Votes, associated documentation, and vote tallies. The Voting Portal can be found at [https://vote.sky.money/executive](https://vote.sky.money/executive).

##### A.1.9.2.1.6 - Custom Spell Voting Page [Core] <!-- UUID: 7171aa68-668e-49bb-bf00-511cb79eb5e9 -->

The custom spell voting page is the public interface used to submit, review, and vote on Executive Votes that are not accompanied by a formal Executive Document. It also supports voting on pre-deployed standby spells by allowing stakeholders to specify target contract addresses and calldata directly. The custom spell voting page can be found at [https://vote.sky.money/custom-spell](https://vote.sky.money/custom-spell).

##### A.1.9.2.1.7 - Spell [Core] <!-- UUID: 7d798e34-cdb0-4416-ab11-b5b48ccf61e6 -->

Spell is a term specific to the Sky Protocol. It refers to all technical components of an Executive Vote, encompassing the codebase, code operations, code reviews, and overall code quality. The term "spell" is often used interchangeably with the Executive Vote itself, as it represents the smart contract responsible for enacting changes to the protocol. Spells are categorized as either "regular" or "out-of-schedule." Regular spells adhere to a biweekly cadence, while out-of-schedule spells are handled with service-level agreements \(SLAs\) determined on a case-by-case basis.

##### A.1.9.2.1.8 - Ecosystem Spell Validation [Core] <!-- UUID: e2bc30b0-1370-44e6-9872-39530ff61d65 -->

Ecosystem Spell Validation \(also referred to as “spell validation” or “validation”\) refers to the process of performing a set of checks and high-level review of a specific spell’s code as it exists on the blockchain \(referred to as a “deployed spell”\). This process applies only to the deployed spell and is not as comprehensive as the reviews conducted during the spell development process by the Spell Reviewers. The purpose of spell validation is to validate the safety of the current spell in respect to its security impacts in relation to Sky Protocol smart contracts.

##### A.1.9.2.1.9 - Spell Roster [Core] <!-- UUID: 34fb69c2-12db-452c-a773-1d3ed706b993 -->

Spell Roster refers to the two teams of technical contributors in the Sky Ecosystem, Sidestream and Dewiz. The Spell Team for the Executive Vote is selected from the members of the Spell Roster.

##### A.1.9.2.1.10 - Spell Team [Core] <!-- UUID: 202874e5-65f8-4250-bfb1-5122e5656395 -->

Each Executive Vote has a dedicated Spell Team, made up of Spell Crafters and Spell Reviewers. The Spell Team must include one Crafter, who is responsible for crafting the spells. The Spell Team must also include at least two Reviewers, responsible for reviewing and confirming that the spells are ready for the Executive Vote, at least one of whom should be a member of a different Ecosystem Actor than the Spell Crafter. A Crafter cannot serve as a Reviewer for the same spell. The Spell Team is a set of technical contributors working on developing all technical and smart-contract-related aspects of a particular Executive Vote, based on instructions set out by the Governance Point.

##### A.1.9.2.1.11 - Spell Crafter [Core] <!-- UUID: e007c08a-5fef-42df-a63b-7b4d78b3366f -->

The Spell Crafter \(the Crafter\) is the person or entity who parses the written instruction set of a proposed Executive to Solidity code in order to develop the spell in the first instance. Every addition, modification, or removal of code or content within the spell must be performed by the Crafter. The designated Spell Crafter must be rotated, such that the same person does not craft the spells for two consecutive Executive Votes. The Spell Crafter is a member of the Spell Team for a particular Executive Vote.

##### A.1.9.2.1.12 - Spell Reviewer [Core] <!-- UUID: 8d7a61c4-c1fd-4fbb-bbe9-1c2d6f4f3cdd -->

The Spell Reviewers \(the Reviewers\) are the people or entities responsible for reviewing the draft spell as parsed by the Spell Crafter. The Reviewers are responsible for verifying the spell, finding issues and catching bugs and mistakes in the spell, and otherwise ensuring its quality. There is an important delineation between the function of Spell Crafters and Spell Reviewers: the Reviewers may not perform any addition, modification or removal of code or content within the spell, although they may suggest changes to the Spell Crafter. Spell Reviewers are members of the wider Spell Team for a particular Executive Vote.

#### A.1.9.2.2 - Roles in the Executive Process [Core] <!-- UUID: fb57a48c-5c33-45a4-a49b-2547234129c0 -->

Several different actors within the Sky Community play a role in the Executive Process. The specific actors involved vary depending on the content of the items included in the Executive Process. These actors are categorized into four groups: Governance Point, Technical Point, Content Liaisons, and SKY holders \(acting directly or via Aligned Delegates and Shadow Delegates\).

##### A.1.9.2.2.1 - Governance Point And Governance Backup [Core] <!-- UUID: b8d55094-f75e-4316-9b68-59cbb72e5b26 -->

The Governance Point is selected from the Core Facilitators. Currently, the only Core Facilitator is JanSky. Each Spell also has a designated Governance Backup. The Governance Backup is required to assume the responsibilities of the Governance Point if the original Governance Point becomes unavailable, effectively stepping into the role as needed. The Governance Point is responsible for coordinating the Executive Vote and ensuring that the information in the Executive Sheet accurately reflects the progress of the spell.

The Technical Point has domain expertise as the crafter of the smart contracts, but the Governance Point also has crucial context and should serve as a cross-check to the extent they can. The Governance Point is expected to ask questions where needed.

###### A.1.9.2.2.1.1 - Role Of Governance Point And Backup [Core] <!-- UUID: 4137e37c-27ac-4618-8327-d88a23a7c9ce -->

The role of Governance Point and Governance Backup alternates from within the Core Facilitator. The positions rotate, following an internal schedule.

###### A.1.9.2.2.1.2 - Responsibilities For Governance Point [Core] <!-- UUID: 6de84303-18f4-4d70-b259-b8f02c49b9bc -->

The Governance Point has the following responsibilities in the Executive process:

• Gather the proposed content for the Executive sheet and prepare a draft of the Executive Vote.

• Align on Executive Vote contents with the relevant teams, and coordinate technical details.

• Ensure the contents of each Executive Vote are justified by processes or structures ratified by Sky Governance.

• Produce the text \(Executive Document\) that accompanies each Executive Vote and verify that the delivered code matches the code reviewed and approved on GitHub and that it contains all expected actions from the sheet.

• Publish the Executive Vote on the official Voting Portal.

##### A.1.9.2.2.2 - Technical Point [Core] <!-- UUID: 6474ab2e-da22-4227-9aff-7f13ac0dd471 -->

The Technical Point role is filled by the Spell Team or the Spell Crafter from that group. For each Executive Vote, a Spell Team is selected from the Spell Roster to steward the spell development process.

Within the Spell Team, the Spell Crafter serves as the primary point of contact for the Governance Point and any external parties. If the Spell Crafter is unavailable or if disagreements arise, the Governance Point’s secondary point of contact is the Spell Reviewers.

Input or opinions from external parties on technical details should be treated as informational and should not influence the spell decision-making process.

###### A.1.9.2.2.2.1 - Spell Team Configuration [Core] <!-- UUID: 4862ed4e-097b-42fa-a197-1d407d220a77 -->

The Spell Team consists of the Crafter\(s\) and Reviewers for a designated spell.

Currently, Sky has two teams of technical contributors for spell development, Dewiz, and Sidestream. They rotate the responsibility of crafting and reviewing as follows:

• When Dewiz is crafting:  
 ◦ Crafting: one Dewiz member  
 ◦ Reviewing: one Dewiz member, one Sidestream member

• When Sidestream is crafting:  
 ◦ Crafting: one Sidestream member  
 ◦ Reviewing: one Sidestream member, one Dewiz member.

##### A.1.9.2.2.3 - Content Liaisons [Core] <!-- UUID: 4ed84898-db7b-4759-bd00-e3cf09ac27e9 -->

The Content Liaisons are the stakeholders involved in a specific spell. They participate in the verification process and confirm the accuracy of items relevant to their area of expertise, to ensure accuracy of those items in the Executive Sheet. Many different actors in the Sky Ecosystem serve as Content Liaisons for Executive Votes.

##### A.1.9.2.2.4 - SKY Holders [Core] <!-- UUID: 3e1d0486-4805-4bed-a246-f75198e111e6 -->

The SKY token is a governance token that grants the owner voting rights in the Sky Protocol. SKY holders can exercise their voting power directly by participating in governance decisions, such as Executive Votes, or they can delegate their tokens to an Aligned Delegate or a Shadow Delegate to vote on their behalf.

###### A.1.9.2.2.4.1 - Aligned Delegates [Core] <!-- UUID: 891a72ff-bfdc-4353-b6a0-0719de4d36ac -->

Aligned Delegates are recognized representatives who vote on Sky governance decisions on behalf of their delegators. They are officially listed in the Atlas and, if they fulfill certain requirements such as operational security and engagement levels, they can receive compensation from Sky. They validate and vote on Executive Votes, and should inform the community about their validation of a Spell, along with the reasoning for their vote, through the Sky Forum.

###### A.1.9.2.2.4.2 - Shadow Delegates [Core] <!-- UUID: c38ceb17-a35c-4f1c-a526-2267d1b424b5 -->

Shadow Delegates serve as alternative representatives for SKY holders who delegate their tokens. They are not officially recorded in the Atlas and do not receive any compensation from Sky. They may participate in governance decisions and vote on behalf of their delegators.

#### A.1.9.2.3 - Content Of The Executive Vote [Core] <!-- UUID: 7b4c9934-5ba4-4218-b601-8f44ffb5881e -->

The content of an Executive Vote typically consists of the set of onchain changes executed by the Spell. Depending on the specific needs of Sky and the Agents, an Executive Vote may also include DAO resolutions or other off-chain decisions.

There is a set of recurring items in all Executive Votes, and some onchain changes reflect frequently occurring actions. These are set forth in more detail in the subdocuments herein.

##### A.1.9.2.3.1 - Recurring Items [Core] <!-- UUID: d1d16776-3eec-4e7d-b591-052fe9c2c45b -->

For each Executive Vote, the parameters listed in the subdocuments herein are always specified. It is the Spell Crafter who is responsible for identifying if the proposed contents of the Spell require the parameters to be set to “Yes” or “No”.

###### A.1.9.2.3.1.1 - Office Hours [Core] <!-- UUID: 11cf1764-aefa-4343-ad44-e993024b3192 -->

Office hours are set to “Yes” if a spell introduces major changes that can affect external parties, or if a stakeholder makes a specific request for the office-hours modifier to be switched on. Typical examples include collateral offboarding, onboarding new modules, oracle changes, and other actions that may have a significant impact on the protocol or its users.

While stakeholders can request that Office Hours be switched on, the final decision and responsibility for setting this parameter rests with the Spell Crafter. If the office hours modifier is on, the spell can only be executed between 14:00 and 21:00 UTC, Monday - Friday. The purpose of this modifier is to ensure that Ecosystem Actors are available to address any issues that may arise during or shortly after the execution of the spell. The spell will have an extra restriction on top of the GSM Pause Delay, meaning it can only be cast during that timeframe, regardless of when it was approved.

###### A.1.9.2.3.1.2 - Global Line Modifier [Core] <!-- UUID: df0835ea-e299-4fe2-aaca-3926f09913b9 -->

The Global Line Modifier, also referred to as the Global Debt Ceiling, defines the system-wide debt ceiling for Sky. It is set to “Yes” if there is a modification to any collateral type’s line that necessitates that the global Line is also modified.

###### A.1.9.2.3.1.3 - Order Of Operations [Core] <!-- UUID: 18b4c424-68bd-4599-b8b5-9325d0dd8f3b -->

The Order of Operations parameter is relevant when actions within a spell, or across multiple spells, must be executed in a specific order to ensure that the correct final value is set. This applies to cases where dependencies, conflicting changes, or timing-sensitive modifications require precise sequencing to achieve the intended outcome. The Order of Operations parameter is set to “Yes” when actions must be executed in a specific order.

##### A.1.9.2.3.2 - Common Items [Core] <!-- UUID: 64edb1ca-e577-41c4-aa9e-5af759b2d240 -->

Some onchain changes frequently occur as part of the normal operations of Sky. Sometimes these common items have specialized processes associated with them. Common items for Executive Votes are listed in the subdocuments herein.

###### A.1.9.2.3.2.1 - Smart Contract Deployment Verification [Core] <!-- UUID: 55e774c1-dcef-4262-bc47-c32c94c0d557 -->

For deployments of new modules such as an Allocation System Invocation or SP-BEAM, or to replace an old module, the process outlined in the subdocuments must be followed. The subdocuments provide additional detail regarding the smart contract deployment verification for each step in the Executive Process, where relevant. Unless otherwise stated, the normal process set out in [A.1.9 - Executive Process Breakdown](98298ab3-8d08-4c4f-b47b-81242a3e3903) applies.

####### A.1.9.2.3.2.1.1 - Preparatory Phase for Module Deployment [Core] <!-- UUID: 9ad39944-b2cf-44ab-872c-a57c7eba1d5a -->

Before the Executive Process begins, the module is implemented, tested, audited, and reviewed by relevant stakeholders to ensure readiness for inclusion. These steps will be further developed in a future iteration of the Atlas. The subdocuments describe the crafting of an Atlas Edit Proposal for a technical deployment.

######## A.1.9.2.3.2.1.1.1 - Atlas Crafting Stage [Core] <!-- UUID: 12a9e981-412d-4d34-b014-5500c33901d4 -->

The stage of crafting an Atlas Edit Proposal to integrate the module into the Atlas is outlined in the subdocuments herein.

######### A.1.9.2.3.2.1.1.1.1 - Atlas Draft [Core] <!-- UUID: 1ab0de04-ea89-473f-b0b5-5c30219dcde8 -->

Core GovOps Atlas Axis receives a policy document or other relevant documentation explaining the required features and technical specifications of the new module.

######### A.1.9.2.3.2.1.1.1.2 - Atlas Edit Review [Core] <!-- UUID: 7ac692f1-9829-41d8-83d4-4cb1bd053302 -->

Atlas Axis reviews the provided documentation, ensuring alignment with Atlas standards, and updates the documents as necessary.

######### A.1.9.2.3.2.1.1.1.3 - Atlas Edit Sign-Off [Core] <!-- UUID: 7b41e751-8387-426f-9ff5-e45cc032e172 -->

Atlas Axis shares the draft proposal with the relevant Ecosystem Actors for final review and sign-off, confirming that the proposal meets all requirements and expectations.

######### A.1.9.2.3.2.1.1.1.4 - Atlas Edit Proposal [Core] <!-- UUID: 0465a8ef-0ec5-43b7-8b6f-bed778758364 -->

Atlas Axis publishes the proposal as an Atlas Edit Proposal, which is submitted for inclusion in a subsequent Governance Poll to seek community approval for integration into the Atlas.

####### A.1.9.2.3.2.1.2 - Forum Post And Deployment Of Module [Core] <!-- UUID: 8dc369b7-36bd-46f2-b66b-cd336035fa89 -->

The module deployment is discussed on the [A.1.9 - Governance Point Conducts GovOps Meeting Week 1 Tuesday \(Step 3\)](0f74afdf-bc2d-4512-9b11-8f5a26511787) and the actions specified in the subdocuments are taken.

######## A.1.9.2.3.2.1.2.1 - Deployment And Forum Post [Core] <!-- UUID: 769c850b-9e74-4706-bbce-b65c3f47c32c -->

During this stage the module is deployed and a Technical Forum Post is created.

######### A.1.9.2.3.2.1.2.1.1 - Module Deployment [Core] <!-- UUID: 22ee3dc8-47e1-4591-b341-ddef5f4a53aa -->

The module is usually deployed eight or seven days prior to the spell.

######### A.1.9.2.3.2.1.2.1.2 - Technical Scope Forum Post [Core] <!-- UUID: ef6d73e5-cdcb-48dd-873c-264c07af80bf -->

The team that implemented and deployed the module publishes a Forum Post with the technical scope. The Spell Team not involved in the technical Forum Post creation must confirm the contents of the Forum Post as a public reply to ensure transparency and independent verification.

########## A.1.9.2.3.2.1.2.1.2.1 - Requirements For Forum Post [Core] <!-- UUID: 3d031b7c-1b1f-4f84-8668-1cdf43cb2ab2 -->

The Forum post must include the following:

• The addresses of the deployed contracts

• A link to the audit reports, ideally externally verifiable sources, such as the Chain Security website link to an audit report.

• Confirmation that the deployed code matches the commit hash that was sent for audit.

• Constructor arguments are as expected in the Init script

• \(optional\) Authority is given to the protocol owner: `MCD_PAUSE_PROXY` in the case of SKY and denied from the deployer address.

• Include instructions to be added to the Executive Sheet, such as adding the module to the chainlog, defining parameters for the module \(provided by the Risk Advisor\), further authorization that needs to be done to different module elements.

######### A.1.9.2.3.2.1.2.1.3 - Core Facilitator Approve Inclusion In Executive Vote [Core] <!-- UUID: d0c4f880-902e-4d32-ac55-f05725753ac1 -->

The Core Facilitator should post a reply to the Technical Scope Forum post and approve its inclusion in the next Executive Vote.

####### A.1.9.2.3.2.1.3 - Populating Content Regarding Module Deployment In Executive Votes [Core] <!-- UUID: 5e125907-87f9-4c3a-b1a8-54ad6c204179 -->

The actions specified herein take place as part of the [A.1.9 - Governance Point Creates Executive Sheet Week 1 Monday \(Step 2\)](298819fe-cc26-49a8-a7cb-3ff83e55f291) step of the Executive Process.

######## A.1.9.2.3.2.1.3.1 - Governance Point Includes Module Deployment In The Executive Sheet [Core] <!-- UUID: d2a2b598-db4d-44b5-a23b-a7f62cadfa9d -->

The Governance Point should include the module deployment in the Executive Sheet. The “Input Action” describes the high level logic of the Deployment, for example “Add \[Module Name\] to Chainlog”. The Reasoning URL for the “Input Action” should contain a link to the Atlas Edit Proposal Forum post specified in [A.1.9 - Technical Scope Forum Post](ef6d73e5-cdcb-48dd-873c-264c07af80bf) and the Authority URL for the “Input Action” should contain a link to Atlas documents. The “Derived Action” is more specific for deployment address and other necessary information. The Reasoning URL for the “Derived Action” should contain a link to the Technical Scope Forum post specified in [A.1.9 - Technical Scope Forum Post](ef6d73e5-cdcb-48dd-873c-264c07af80bf) and the Authority URL for the “Derived Action” should contain a link to the approval of the Core Facilitator as specified in [A.1.9 - Core Facilitator Approve Inclusion In Executive Vote](d0c4f880-902e-4d32-ac55-f05725753ac1).

######## A.1.9.2.3.2.1.3.2 - Confirmation Of Module Deployment In The Executive Sheet [Core] <!-- UUID: 10ccad57-0d04-4d95-89d5-1da66e6172f9 -->

The author of the Forum post usually acts as Content Liaison and confirms in the Executive Sheet see [A.1.9 - Confirmation By Content Liaisons](26133c1d-29da-42de-b9a2-00f4e13699f2).

####### A.1.9.2.3.2.1.4 - Populating Content Regarding Module Deployment In Executive Document [Core] <!-- UUID: fb98f4b8-d45e-47ac-8a88-a3cc1e71c42e -->

The actions specified herein take place as part of the [A.1.9 - Core Facilitator Creates And Finalizes Executive Document Week 2 Tuesday \(Step 8\)](1df24674-3095-44a7-b1b6-cb583b0787dd) step of the Executive Process.

######## A.1.9.2.3.2.1.4.1 - Core Facilitator Includes Module Deployment In The Executive Document [Core] <!-- UUID: b81371c0-0bfb-4276-9fcb-f333de6e5a3a -->

The Core Facilitator must include the module deployment in the Executive Document. The format for this content should be as specified below:

• The title of the module deployment should be listed as a section for example “Add \[Module Name\] to the Chainlog”.

• The authorization should include links to the Atlas documents and the approval from the Core Facilitator.

• The proposal should include links to the Technical Scope Forum post created by the team that deployed the module and the Atlas Edit Proposal.

###### A.1.9.2.3.2.2 - Prime Spells [Core] <!-- UUID: 8b5181e8-51e2-4d8b-a49a-d88ab42218e7 -->

A future iteration of the Atlas will specify the process for Prime Spells.