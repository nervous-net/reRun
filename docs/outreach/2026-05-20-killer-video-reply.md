# Reply to Jonathon — Killer Video (Akron, OH)

**Lead:** 501c3 video rental era museum, free rentals to members, ~7,000 movies (goal 8,500 by end of August), currently on spreadsheets. Asked about the platform we built for Kevin and Galadriel.

**Status:** Draft — not sent.

---

**Subject: Re: Killer Video + reRun**

Hi Jonathon,

This might be the best email I've gotten all month. A 501c3 built around the video rental era is exactly who we made reRun for — honestly, the look alone is going to feel like coming home.

Quick context: reRun is the rental system we built for Kevin and Galadriel. It runs on a single PC(or Mac if you are cool) at the counter, looks like a green-phosphor CRT terminal straight out of 1987, and handles the daily grind of a rental shop with no monthly SaaS bill hanging over you. It's open source, and your data lives in a file on your own machine — not on someone else's server.

Here's why I think it fits what you're doing:

**Getting 7,000 movies out of the spreadsheet.** This is the part you'll feel on day one. You upload your spreadsheet, map your columns once, and reRun looks up each title automatically — pulling cover art, genre, runtime, cast, director, and synopsis so your catalog is more than a list of names. It assigns barcodes as it goes. Your 8,500-by-August goal is well inside what it handles.

**The counter workflow.** Scan a member, scan a tape, done. Returns work the same way — scan it back in. Members get a card, and you can track family members under one membership, which sounds right for a museum lending to households. Holds, due dates, and automatic daily backups are all in there. (You can also just look up members which is what Galadriel is doing)

Two things I want to be straight about, because your model is a little different from a normal shop:

- **Free rentals.** Already handled. A loan checks out at $0 — nothing to charge, nothing to collect. You scan the member, scan the tape, and it's out the door.
- **Importing your members.** The movie import is built in. How many members do you have? There might be a way to use a script to import them.

Neither is a dealbreaker — they're just the spots where your version would differ from Kevin and Galadriel's.

The honest next step is to take a look at: https://github.com/nervous-net/reRun/blob/main/INSTALL.md and then let me know if you have any questions. This is an open source project so it is free to use and totally free if you can get it installed on your own. It can be a little HACKERS to get started but once it is going it is magic. 

Talk soon,
Dylan
