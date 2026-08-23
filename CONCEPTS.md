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

Live is distinct from Enabled, which is an admin's decision that a Channel is open at all, and distinct from the Speaker's broadcast claim, which is taken when their page connects and can be held by someone who has not gone Live yet. A Channel can therefore be Enabled, claimed by a Speaker, and still not Live.

### Muted
The reversible state in which a Live Channel's Producer is paused, so its Listeners hear no audio even though the broadcast has not ended.

Muting leaves the Channel Live, preserves its Consumers and Listener count, and is surfaced to active Listeners to explain silence rather than redefining the Channel's liveness.

### Broadcast claim
The exclusive right to speak on one Channel, held by whoever presented its Speaker code first. A Channel has one claim at a time; a second interpreter arriving with a different code is refused as busy.

The claim is held against the Speaker code rather than a particular connection, so an interpreter whose device drops and returns reclaims their own Channel instead of colliding with the session they just lost. A second device presenting the same code takes the claim over, and the displaced session is told rather than silently retrying.

A claim is not Live: it is taken when the studio connects, which is before any audio exists and may be long before any is produced.

### Listening
Actually receiving a Channel's audio: holding an open Consumer on its Producer that the guest's
own side has not paused. This is what the listener counts on the Speaker studio and the admin
Event detail report.

Listening is narrower than Armed, which is the request, and narrower than having the page open,
which allocates nothing at all. It is also downstream of Live: no Producer means no Consumers,
so a Channel that is not Live has nobody Listening, and the count is structurally zero before an
interpreter goes live rather than merely unknown. Muting does not change it — the Speaker's
Producer pauses while every Consumer stays open, so a muted interpreter still has an audience.

Nothing here learns who is Listening. The count is a number, and Listener identity is outside
this product.

### Armed
A Listener who has asked to hear a Channel and is waiting on audio rather than receiving it. Arming is the guest's one deliberate gesture; everything after it is automatic. An Armed Listener whose Speaker disappears stays Armed and resumes on their own when the Speaker returns, so a dropped connection mid-event never asks the guest to do anything.

### PIN
The short numeric code that grants listening on one Event. A guest types it or receives it inside a Listener link. It is regenerable, which revokes every link and printed code carrying the old value.

### Speaker code
The secret that grants broadcasting on one Channel — never on the Event as a whole. It is regenerable on the same terms as a PIN.

The speaker link is the ordinary Channel URL with the code attached, so stripping the code degrades it into a valid Listener link rather than breaking it.

### Listener link
The URL that takes a guest straight into an Event, carrying its PIN. Also rendered as a QR code for printing or projecting. Possession of the link is the entire authorization to listen.

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

### Worker
An operating-system process that hosts Rooms, one of a fixed pool started at boot. A Room lives entirely on the Worker it was created on and nothing is piped between Workers, so one Event is bounded by one Worker no matter how many exist.

That makes the pool size a concurrency limit across Events rather than a capacity limit within one: more Workers let simultaneous Events occupy separate cores, and they isolate failure, since a Worker dying takes only the Rooms that lived on it. A new Room is placed on whichever Worker currently holds the fewest. A Worker that cannot start at boot is fatal; one that dies later is not, because a single crash must not silence every concurrent Event.

### Room
The media state for one Event: a single router on one Worker, holding every producer on that Event's Channels, plus the transports and consumers of everyone connected to it. Distinct from a *socket room*, which is Socket.IO's fan-out group and exists whether or not any audio does.

A Room comes into being on the first go-live within its Event and on nothing else — not when the Event is enabled, and not when a Listener arms — and is destroyed once it has held no producers and no transports for a grace period. Its whole existence is in memory, so a restart simply removes it.

### Producer
The server-side carrier of one Speaker's audio into a Room, brought into being by the deliberate go-live act and ending when that Speaker stops. A Channel has at most one Producer, and its existence is exactly what makes that Channel Live.

Pausing a Producer is what muting does: the audio stops without the broadcast ending, so the Channel stays Live throughout. Producing again on a Channel that already has one replaces it rather than adding a second. A Producer's identifier is not a secret — every Listener who consumes that Channel is told it — so holding one grants nothing on its own.

### Consumer
The server-side carrier of a Room's audio out to one Listener. A Listener holds at most one Consumer per Channel, which is why switching language swaps a Consumer rather than rebuilding the connection underneath it.

A Consumer is created paused and begins only once the Listener confirms it is ready to play, so audio never arrives before there is anything to play it. It closes on its own when its Producer closes, which is how every Listener's audio stops the instant a Speaker does, without anyone being told to stop.

### Eviction
Ending a session from the server's side, rather than waiting for the client to notice. It is what makes an admin's write true of what is audible and not only of what the API reports: disabling, deleting, or regenerating a code evicts whoever that write took access from.

Eviction is scoped either to one peer, named by its connection, or to a whole Event. The second exists because a Listener who never armed owns no media and so cannot be named individually — and that Listener is exactly who a regenerated PIN has to remove.
