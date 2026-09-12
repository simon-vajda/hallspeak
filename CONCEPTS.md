# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Relationships

An Event owns one or more Channels and is deleted with them. A PIN belongs to the Event; a Speaker code belongs to a single Channel. Both are regenerable, so neither identifies its row — regenerating one invalidates the links that carry it without disturbing anything else. Enabled is set independently on an Event and on each of its Channels, and both must be enabled for a guest to reach that Channel.

## Events and channels

### Event
A single occasion being interpreted — one service, one conference session, one talk. An Event is what a guest joins; it carries a name, an optional description, and the Channels a guest chooses between.

### Channel
One interpretation stream within an Event, in practice one target language. A Channel has exactly one Speaker at a time and any number of Listeners.

A Channel's slug is fixed at creation and unique only within its Event. It is deliberately not derived from the editable display name: the slug appears in every printed QR code, so renaming a Channel must not move it.

### Enabled
Whether an Event or a Channel is open to guests. Both default to closed and are opened by a deliberate admin action.

Enabled carries no direction in time — the same closed state means "not yet" before an Event and "over" afterwards. This is why there is no separate lifecycle or status concept: a project looking for one should use Enabled.

### Live
Whether audio is actually being broadcast on a Channel. A Channel is Live for exactly as long as a Producer exists on it — from the deliberate "go live" act until that production ends. Muting does not end it: a muted Speaker is present and still holds the Channel.

Live is distinct from Enabled, which is an admin's decision that a Channel is open at all, and distinct from the Broadcast claim, which is taken by the same go-live act but outlives a momentary gap in the audio: a Channel is briefly not Live while its Speaker's connection is rebuilding, and the claim stays with them throughout. A Channel can therefore be Enabled, claimed by a Speaker, and still not Live.

### Muted
The reversible state in which a Live Channel's Producer is paused, so its Listeners hear no audio even though the broadcast has not ended.

Muting leaves the Channel Live, preserves its Consumers and Listener count, and is surfaced to active Listeners to explain silence rather than redefining the Channel's liveness.

### Withheld
A reading a surface cannot currently make, reported as its own outcome rather than as the negative one it resembles.

Whether a Channel is on air is learned from a source that can be pending, failing, or stalled, and a source with nothing to say is indistinguishable from one that is not answering. A withheld reading is shown as an absence with the words "status unknown" available to a screen reader, never as nobody broadcasting. Configuration the reading has no bearing on — a disabled or empty Event — is still stated plainly. An action that would end a broadcast says that liveness could not be checked instead of confirming silently, so a withholding never becomes a quiet yes.

### Broadcast claim
The exclusive right to speak on one Channel, taken by going Live and held until that Speaker stops, departs, or hands the Channel over. A Channel has one claim at a time.

Opening the speaker studio takes nothing. Two interpreters working a Channel share its Speaker code and both have the studio open; the one who goes Live first holds it, and the other sees a live Channel rather than an error. Moving it is a Handover and nothing else — there is no way to take the claim from someone who has not agreed or been given time to.

The claim is held against the studio's own page rather than against the Speaker code or a particular connection, so an interpreter whose device drops and returns resumes their own broadcast instead of colliding with the session they just lost, while a colleague's studio presenting the same code is recognisably somebody else. A reload is a different studio: it frees the Channel, or hands it on.

A claim is not Live. It survives a reconnect that Live does not, and a Speaker who ends their broadcast gives it up while their studio stays open.

The claim also carries when the Channel went on air, which is what the studio's elapsed timer reads. A Handover moves that moment with the claim, so an interpreter taking over continues the broadcast's clock rather than starting a second one; only ending the broadcast resets it.

### Handover
Moving a Channel's Broadcast claim from one interpreter to another without the broadcast ending.

The interpreter who wants the Channel asks for it; the one on air can hand it over at once, and if they do not, the asker may take it after thirty seconds. The wait exists so nobody is cut off mid-sentence and so a studio nobody is sitting at cannot hold a Channel for the rest of an Event. There is no way to decline — a colleague who is ready should not be held off — and only one Handover runs on a Channel at a time.

However it is agreed, the swap itself overlaps: the outgoing interpreter keeps transmitting while the incoming one starts, and each Listener moves across in a single step, so the Channel is never reported off air and nobody hears a gap or two voices at once. Every way the live interpreter leaves while somebody is waiting is a Handover too — confirming, ending the broadcast, closing the page, dropping off the network — because the person waiting has already said they are ready.

A Handover is not an Eviction: neither studio is disconnected, and the one that gave the Channel up lands back where it started, free to ask for it again.

A Handover belongs to the studios taking part, not to their connections. An interpreter whose connection drops and returns while asking for a Channel, or while taking it over, keeps their place, exactly as a live interpreter keeps the Broadcast claim across a reconnect. A studio that does not come back gives up its place.

### Listening
Actually receiving a Channel's audio: holding an open Consumer on its Producer that the guest's
own side has not paused. This is what the listener counts on the Speaker studio and the admin
Event detail report.

Listening is narrower than a playback hold, which preserves a prior request without receiving
audio, and narrower than having the page open, which allocates nothing at all. It is also
downstream of Live: no Producer means no Consumers, so a Channel that is not Live has nobody
Listening, and the count is structurally zero before an interpreter goes live rather than merely
unknown. Muting does not change it — the Speaker's Producer pauses while every Consumer stays
open, so a muted interpreter still has an audience.

Nothing here learns who is Listening. The count is a number, and Listener identity is outside
this product.

### Issue report
An anonymous signal from one Listener that a Channel's audio is wrong, chosen from five fixed
categories and carrying nothing else — no text, no identity, no history the Speaker can read back
to a person.

Reports are counted, not delivered. The server holds a per-Channel tally over a rolling five-minute
window and shows it to whoever holds the Broadcast claim, so an interpreter sees how many people
are reporting each category and how recently, and nobody else sees it at all. A report ages out of
the window on its own; the tally is a current problem rather than a session log, and it is process
memory that no restart preserves.

Reporting requires a Live Channel and a guest in that Channel's room: a report on an idle Channel
has no recipient.

One accepted report opens a connection-scoped feedback episode. Until that episode is closed, the
Listener can confirm **Audio sounds good now** independently of the two-minute category cooldown.
That confirmation removes the connection's still-active problem reports and appears to the Speaker
as a separate positive tally for 30 seconds; it is not a sixth problem category.
The episode stays open after its problem rows age out, but ends on confirmation, disconnect, or a
deliberate end to the Broadcast. A confirmation never claims that every Listener's audio is fixed.

### Playback hold
A bounded recovery state entered only when an unexpected Producer close interrupts a Listener
who was receiving audio. The Listener keeps the request for 30 seconds, resumes automatically if
the Producer returns before the stored deadline, and otherwise returns to idle. A deliberate end,
an expired deadline, or a lost link clears the hold immediately.

### PIN
The short numeric code that grants listening on one Event. A guest types it or receives it inside a Listener link. It is regenerable, which revokes every link and printed code carrying the old value.

### Speaker code
The secret that grants broadcasting on one Channel — never on the Event as a whole. It is regenerable on the same terms as a PIN.

The speaker link is the ordinary Channel URL with the code attached, so stripping the code degrades it into a valid Listener link rather than breaking it.

### Listener link
The URL that takes a guest straight into an Event, carrying its PIN. Also rendered as a QR code for printing or projecting. Possession of the link is the entire authorization to listen.

The mobile app registers its own URL scheme, so the same destination can also arrive as an app link rather than a web address. Arriving that way carries no more authorization than the link itself and no less — and, because anyone can compose one, it is not evidence that the address was ever checked.

### Event history
The device-local record of the Events a guest has opened, held by the mobile app and by nothing on any server. Each entry names an Event by the address that hosts it together with its PIN, because a PIN is unique to its server rather than to the world.

It is never a server query. The list spans many self-hosted origins, so no one of them could assemble it, and asking every stored origin whether a guest still belongs there would disclose where that person worships to servers that did not ask. An entry records no Channel: returning to an Event means choosing a language again, which is a property of that service rather than of the last visit. Only the guest removes an entry, so an Event that could not be reached is marked and kept rather than dropped.

### Admin
The only authenticated role in the system, and a single account. The Admin creates Events and Channels, enables them, regenerates PINs and Speaker codes, and shares the links.

Speakers and Listeners are deliberately not accounts: they are authorized purely by holding a link or code. Requiring anything more of them is treated as a product defect, not a security improvement.

The Admin's credentials are held outside the database, in a file the server writes and reads once at startup. There is no password reset inside the product: recovery means deleting that file and restarting the server, which is why it is an act of whoever can reach the machine rather than of whoever is looking at the screen.

### Unconfigured
A server that started with no Admin credentials — a fresh install, or one whose credential file was deleted to recover a forgotten password. An Unconfigured server offers the setup wizard and has no Admin.

It is a property of the running process, not of the data: Events, Channels, PINs and Speaker codes survive it untouched, and Listener and Speaker links keep working while it lasts. Only the site root and the admin surface divert to the wizard. Because the credential file is read once at startup, a server cannot become Unconfigured while running — it can only start that way.

## Protocol

### Problem
The one error shape every failure crosses a boundary in — a machine-readable code plus a human-readable message. It is transport-agnostic: HTTP responses and socket acknowledgements carry the same shape, so a caller has one thing to handle either way.

A failure that produces no Problem is a bug in whatever produced it, not a case for callers to special-case. Clients synthesize a Problem for failures that never reached the server, so that "the API refused" and "the API never answered" arrive through the same path.

### Signalling
The out-of-band exchange that negotiates a media connection before audio flows — capabilities, transport parameters, producers and consumers. It names a *role* played over the socket, not the socket itself: the transport is a socket, and signalling is one of the things carried on it alongside presence and room membership.

### Announced address
Where the server tells a client to connect back to it, as distinct from where it listens. The two differ on any deployment behind NAT: the server binds a local address and must name a public one, and nothing in the protocol checks that the name it gives is reachable — a wrong one produces well-formed instructions nobody can act on, and no error anywhere.

It is announced in whichever forms clients need rather than one canonical form, because browsers disagree about what they accept: some discard a name and require a literal address, while a device on a network that offers no route to that literal can reach the server only by resolving the name. Offering both is what lets one deployment serve them all, and it is why the operator configures a name and the server resolves it rather than choosing between them.

### Worker
An operating-system process that hosts Rooms, one of a fixed pool started at boot. A Room lives entirely on the Worker it was created on and nothing is piped between Workers, so one Event is bounded by one Worker no matter how many exist.

That makes the pool size a concurrency limit across Events rather than a capacity limit within one: more Workers let simultaneous Events occupy separate cores, and they isolate failure, since a Worker dying takes only the Rooms that lived on it. A new Room is placed on whichever Worker currently holds the fewest. A Worker that cannot start at boot is fatal; one that dies later is not, because a single crash must not silence every concurrent Event.

### Room
The media state for one Event: a single router on one Worker, holding every producer on that Event's Channels, plus the transports and consumers of everyone connected to it. Distinct from a *socket room*, which is Socket.IO's fan-out group and exists whether or not any audio does.

A Room comes into being on the first go-live within its Event and on nothing else — not when the Event is enabled, and not when a Listener arms — and is destroyed once it has held no producers and no transports for a grace period. Its whole existence is in memory, so a restart simply removes it.

### Producer
The server-side carrier of one Speaker's audio into a Room, brought into being by the deliberate go-live act and ending when that Speaker stops. A Channel has at most one Producer, and its existence is exactly what makes that Channel Live.

Pausing a Producer is what muting does: the audio stops without the broadcast ending, so the Channel stays Live throughout. Producing again on a Channel that already has one replaces it rather than adding a second — except during a Handover, where both exist for a moment so Listeners can cross over without a gap. A Producer's identifier is not a secret — every Listener who consumes that Channel is told it, and it is how they follow a replacement — so holding one grants nothing on its own.

### Consumer
The server-side carrier of a Room's audio out to one Listener. A Listener holds at most one Consumer per Channel, which is why switching language swaps a Consumer rather than rebuilding the connection underneath it.

A Consumer is created paused and begins only once the Listener confirms it is ready to play, so audio never arrives before there is anything to play it. It closes on its own when its Producer closes, which is how every Listener's audio stops the instant a Speaker does, without anyone being told to stop.

### Eviction
Ending a session from the server's side, rather than waiting for the client to notice. It is what makes an admin's write true of what is audible and not only of what the API reports: disabling, deleting, or regenerating a code evicts whoever that write took access from.

Eviction is scoped either to one peer, named by its connection, or to a whole Event. Revoking a Channel's Speaker code reaches every studio holding it, not only the one on air: a studio left in pre-flight holds the code that was just revoked. The second exists because a Listener who owns no media cannot be named individually — and that Listener is exactly who a regenerated PIN has to remove.
