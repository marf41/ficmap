package main

import (
    "os"
	"fmt"
	"log"
	"net/http"
	"strings"
    "encoding/json"
    "time"
    // "errors"
    // "strconv"

	// "github.com/gin-gonic/gin"
    "goyave.dev/goyave/v3"
    "goyave.dev/goyave/v3/middleware"
    glog "goyave.dev/goyave/v3/log"
    "goyave.dev/goyave/v3/database"
    "gorm.io/gorm"
    _ "goyave.dev/goyave/v3/database/dialect/sqlite"

	"github.com/xyproto/permissionbolt"
    "github.com/xyproto/pinterface"

    "github.com/googollee/go-socket.io"
    "github.com/satori/go.uuid"
    // "github.com/google/uuid"
)

const nouuidstr = "00000000-0000-0000-0000-000000000000"
var nouuid uuid.UUID

type loginJSON struct {
    Login string `json:"l"`
    Password string `json:"p"`
    Mail string `json:"m"`
}

type userJSON struct {
    Username string
    Factions []string
    Admin bool
    Confirmed bool
}

type factionJSON struct {
    Name string
    Leader string
    Members []string
    Aliases []string
}

type usersJSON struct {
    List []userJSON
    Factions []factionJSON
    Error string
}

type featuresJSON struct {
    List  []POI
    Groups []POIGroup
}

type Faction struct {
    gorm.Model
    Name string `gorm:"unique;not null"`
    LeaderName string
    Leader User `gorm:"foreignKey:LeaderName;references:Username"`
    Members []*User `gorm:"many2many:user_factions;references:Username"`
}

type User struct {
    Username string `gorm:"primaryKey;unique;not null"`
    DisplayName string
    Factions []*Faction `gorm:"many2many:user_factions;foreignKey:Username"`
    Visible []*POIGroup `gorm:"many2many:user_visible;foreignKey:Username"`
}

type POIGroup struct {
    ID        uuid.UUID           `gorm:"primaryKey,type:uuid"`
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
    Name string `gorm:"unique;not null"`
    OwnerName string
    Owner User `gorm:"foreignKey:OwnerName;references:Username"`
    FactionName string
    Faction Faction `gorm:"references:Name"`
    Permissions uint
    Count uint
    Info string
    Depth int
    ParentID *uuid.UUID
    Parent *POIGroup
    Visible bool // for public users
}

type POIData struct {
    gorm.Model
    POIID uuid.UUID
    POI POI
    Type string
    Content string
    Main bool
}

type POI struct {
    ID        uuid.UUID           `gorm:"primaryKey,type:uuid"`
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
    // gorm.Model
    Name string `gorm:"not null"`
    Polyline string `gorm:"size:255;not null"`
    Type string
    OwnerName string
    Owner User `gorm:"foreignKey:OwnerName;references:Username"`
    FactionName string
    Faction Faction `gorm:"references:Name"`
    // Visibility string
    Permissions uint
    Color string
    Icon string
    ZIndex uint
    GroupName string
    Group POIGroup `gorm:"references:Name"`
    DataCount uint
}

func (poi *POI) BeforeCreate(tx *gorm.DB) error {
    if poi.ID == nouuid { tx.Model(poi).Update("ID", uuid.NewV4()) }
    return nil
}

func (group *POIGroup) BeforeCreate(tx *gorm.DB) error {
    log.Printf("----- %s: %v\n\n", group.Name, group.ID)
    if group.ID == nouuid { tx.Model(group).Update("ID", uuid.NewV4()) }
    return nil
}

func (group *POIGroup) AfterFind(tx *gorm.DB) error {
    var zero uuid.UUID
    if group.ParentID != nil {
        parent := POIGroup{}
        tx.Where("ID = ?", group.ParentID).Find(&parent)
        if parent.ID != zero {
            group.Depth = parent.Depth + 1
        }
    }
    return nil
}

var userstate pinterface.IUserState
var perm *permissionbolt.Permissions
var server *socketio.Server

const (
	green   = "\033[97;42m"
	white   = "\033[90;47m"
	yellow  = "\033[90;43m"
	red     = "\033[97;41m"
	blue    = "\033[97;44m"
	magenta = "\033[97;45m"
	cyan    = "\033[97;46m"
	reset   = "\033[0m"
)

func StatusColor(code int) string {
	switch {
        case code >= http.StatusOK && code < http.StatusMultipleChoices: return green
        case code >= http.StatusMultipleChoices && code < http.StatusBadRequest: return white
        case code >= http.StatusBadRequest && code < http.StatusInternalServerError: return yellow
        default: return red
    }
}

func CustomFormatter(now time.Time, resp *goyave.Response, req *goyave.Request, length int) string {
  return fmt.Sprintf("%s %21s |%s %3d %s| %s %s",
    now.Format("15:04:05"),
    req.RemoteAddress(),
    StatusColor(resp.GetStatus()),
    resp.GetStatus(),
    reset,
    req.Method(),
    req.URI().Path,
  )
}

func PermissionMiddleware(next goyave.Handler) goyave.Handler {
	return func(r *goyave.Response, req *goyave.Request) {
		if perm.Rejected(r, req.Request()) {
            // log.Println("Rejected", req.Request().URL.Path)
			r.Status(http.StatusForbidden)
			return
		}
        next(r, req)
	}
}

func wrapH(h http.Handler) goyave.Handler {
    return func(r *goyave.Response, req *goyave.Request) {
        h.ServeHTTP(r, req.Request())
    }
}

func register(r *goyave.Router) {
    db := database.Conn()
    // db.Config.DisableForeignKeyConstraintWhenMigrating = true
    // database.Migrate()
	// Set up a middleware handler for Gin, with a custom "permission denied" message.
    r.Middleware(middleware.Gzip())
    r.Middleware(glog.Middleware(CustomFormatter))
    r.Middleware(PermissionMiddleware)
    // g.StaticFile("/", "./static/index.html")
    // g.StaticFile("/favicon.ico", "./static/favicon.ico")
    r.Route("GET", "/admin", func(r *goyave.Response, greq *goyave.Request) {
		r.String(http.StatusOK, "super secret information that only logged in administrators must see!\n\n")
		if usernames, err := userstate.AllUsernames(); err == nil {
			r.String(http.StatusOK, "list of all users: " + strings.Join(usernames, ",\n"))
		}
	})
    r.Route("GET", "/socket.io/", wrapH(server))
    r.Route("POST", "/socket.io/", wrapH(server))


	// g.GET("/user", func(c *gin.Context) {
        // c.String(http.StatusOK, userstate.Username(c.Request)) })
    r.Route("GET", "/user", func(r *goyave.Response, req *goyave.Request) {
        r.String(http.StatusOK, userstate.Username(req.Request())) })

    r.Route("GET", "/pois", func(r *goyave.Response, req *goyave.Request) {
        user := userstate.Username(req.Request())
        db := database.Conn()
        features := []POI{}
        db.Where("id = ?", nouuid).Delete(&POI{})
        db.Where("permissions = ?", 0).Or("polyline = ?", "").Or("owner_name = ?", "").Delete(&POI{})
        if len(user) > 0 { db.Where("permissions > ?", 99999).Or("owner_name = ?", user).Find(&features)
        } else { db.Where("permissions > ?", 9999).Find(&features) }
        groups := []POIGroup{}
        var zero uuid.UUID
        db.Where("id = ?", nouuid).Or("owner_name = ?", "").Delete(&POIGroup{})
        db.Where("permissions = ?", 0).Delete(&POIGroup{})
        if len(user) > 0 { db.Where("permissions > ?", 9999).Or("owner_name = ?", user).Find(&groups)
        } else { db.Where("permissions > ?", 9999).Find(&groups) }
        empty := POIGroup{ ID: zero, Name: "None", Depth: -1 }
        groups = append([]POIGroup{ empty }, groups...)
        // for _, g := range(groups) { }
        list := &featuresJSON{ List: features, Groups: groups }
        r.JSON(200, list)
    })

    r.Route("GET", "/admin/pois", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        features := []POI{}
        db.Find(&features)
        groups := []POIGroup{}
        db.Find(&groups)
        list := &featuresJSON{ List: features, Groups: groups }
        r.JSON(200, list)
    })

    r.Route("GET", "/newpoi", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        fc := &Faction{ Name: "Flying Caracans" }
        user := User{ Username: "bob", Factions: []*Faction{ fc } }
        poi := POI{ Name: "test", Owner: user }
        result := db.Create(&poi)
        r.String(http.StatusOK, fmt.Sprintf("%v\n", result))
    })

    r.Route("GET", "/newfact", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        fac := &Faction{ Name: "Test" }
        result := db.Create(&fac)
        r.String(http.StatusOK, fmt.Sprintf("%v\n", result))
    })


    r.Route("POST|DELETE", "/data/pois", func(r *goyave.Response, req *goyave.Request) {
        // var err error
        // req.Data["ID"], err = strconv.Atoi(fmt.Sprintf("%d", req.Data["ID"]))
        // if (err != nil) { fmt.Printf("%v: %q.\n", err, req.Data["ID"]); return }
        // if req.Has("ID") { req.Data["ID"] = req.Numeric("ID") }
        db := database.Conn()
        jsonbody, err := json.Marshal(req.Data)
        if (err != nil) { fmt.Println(err); return }
        poi := POI{}
        err = json.Unmarshal(jsonbody, &poi)
        if (err != nil) { fmt.Println(err); return }
        if len(poi.OwnerName) == 0 {
            poi.OwnerName = userstate.Username(req.Request()) }
        fmt.Printf("%v\n", poi)
        // db.Find(&features)
        // list := &featuresJSON{ List: features }
        // r.JSON(200, list)
        first := []POI{}
        firstResult := db.Take(&first, "id = ?", poi.ID)
        hasFirst := firstResult.RowsAffected > 0
        fmt.Printf("ID: %q. Exists: %v\n", poi.ID, hasFirst)
        if req.Method() == "DELETE" || poi.Permissions == 0 || len(poi.Polyline) == 0 {
            if hasFirst {
                db.Delete(&poi)
                r.String(http.StatusOK, fmt.Sprintf("%s", poi.ID))
                return
            }
            err := "Unknown error."
            if (req.Method() == "DELETE") { err = "Nothing to delete." }
            if (poi.Permissions == 0) { err = "Not a public object." }
            if (len(poi.Polyline) == 0) { err = "Missing position data." }
            r.String(http.StatusNotFound, err)
            return
        }
        if len(poi.Name) == 0 { r.Status(http.StatusNotModified); return }
        result := db.Save(&poi)
        fmt.Printf("ID: %s. Error: %v\n", poi.ID, result.Error)
        if result.Error == nil { r.String(http.StatusOK, fmt.Sprintf("%s", poi.ID))
        } else { r.String(http.StatusInternalServerError, fmt.Sprintf("%s", result.Error)) }
    })

    r.Route("GET", "/users", func(r *goyave.Response, greq *goyave.Request) {
        req := greq.Request()
		msg := ""
		msg += fmt.Sprintf("Has user bob: %v\n", userstate.HasUser("bob"))
		msg += fmt.Sprintf("Logged in on server: %v\n", userstate.IsLoggedIn("bob"))
		msg += fmt.Sprintf("Is confirmed: %v\n", userstate.IsConfirmed("bob"))
		msg += fmt.Sprintf("Username stored in cookies (or blank): %v\n", userstate.Username(req))
		msg += fmt.Sprintf("Current user is logged in, has a valid cookie and *user rights*: %v\n", userstate.UserRights(req))
		msg += fmt.Sprintf("Current user is logged in, has a valid cookie and *admin rights*: %v\n", userstate.AdminRights(req))
		r.String(http.StatusOK, msg)
	})

	// g.GET("/register", func(c *gin.Context) {
    r.Route("GET", "/register", func(r *goyave.Response, req *goyave.Request) {
		userstate.AddUser("bob", "hunter1", "bob@zombo.com")
		userstate.SetAdminStatus("bob")
		r.String(http.StatusOK, fmt.Sprintf("User bob was created: %v\n", userstate.HasUser("bob")))
	})

    r.Route("GET", "/addgroups", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        a := POIGroup{ Name: "Krater", Depth: 0, Permissions: 10000, OwnerName: "system" }
        result := db.Create(&a)
        krater := POIGroup{}
        db.Where("name = ?", "Krater").Find(&krater)
        log.Printf("%v\n", krater)
        b := POIGroup{ Name: "Flying", Parent: &krater, Permissions: 10000, OwnerName: "system" }
        result = db.Create(&b)
        c := POIGroup{ Name: "Azyl", Parent: &krater, Permissions: 10000, OwnerName: "system" }
        result = db.Create(&c)
        fc := POIGroup{}
        db.Where("name = ?", "Flying").Find(&fc)
        d := POIGroup{ Name: "Dworzec", Parent: &fc, Permissions: 10000, OwnerName: "system" }
        result = db.Create(&d)
        r.String(http.StatusOK, fmt.Sprintf("%v\n", result))
    })


    r.Route("POST", "/login", func(r *goyave.Response, req *goyave.Request) {
        rf := req.Request()
        user := rf.PostFormValue("user")
        passwd := rf.PostFormValue("passwd")
        state := userstate.CorrectPassword(user, passwd)
        fmt.Printf("Login attempt: %q, %q, %v.\n", user, passwd, state)
        if state { userstate.Login(r, user); r.String(http.StatusOK, user)
        } else { r.Status(http.StatusUnauthorized) }
    })

    r.Route("GET", "/logout", func(r *goyave.Response, req *goyave.Request) {
        user := userstate.Username(req.Request())
		userstate.ClearCookie(r)
		userstate.Logout(user)
		r.String(http.StatusOK, fmt.Sprintf("%q is now logged out: %v\n", user, !userstate.IsLoggedIn(user)))
	})

    r.Route("GET", "/admin/user", func(r *goyave.Response, req *goyave.Request) {
        r.String(http.StatusOK, userstate.Username(req.Request())) })

    r.Route("POST", "/admin/admin", func(r *goyave.Response, req *goyave.Request) {
        rf := req.Request()
        user := rf.PostFormValue("user")
        if userstate.IsAdmin(user) {
            userstate.RemoveAdminStatus(user)
        } else {
            userstate.SetAdminStatus(user)
        }
        r.Status(http.StatusOK)
    })

    r.Route("POST", "/admin/confirm", func(r *goyave.Response, req *goyave.Request) {
        rf := req.Request()
        user := rf.PostFormValue("user")
        if userstate.IsConfirmed(user) {
            userstate.SetBooleanField(user, "confirmed", false)
        } else {
            userstate.Confirm(user)
        }
        r.Status(http.StatusOK)
    })

    r.Route("GET", "/admin/users", func(r *goyave.Response, req *goyave.Request) {
        all, err := userstate.AllUsernames()
        userList := []userJSON{}
        if (err != nil) { r.Status(http.StatusInternalServerError); return; }
        for _, u := range(all) {
            userList = append(userList, userJSON{
                Username: u,
                Admin: userstate.IsAdmin(u),
                Confirmed: userstate.IsConfirmed(u),
                Factions: []string{},
            })
        }
        db := database.Conn()
        dbfac := []Faction{}
        result := db.Find(&dbfac)
        strerr := ""
        factions := []factionJSON{}
        if result.Error != nil { strerr = fmt.Sprintf("%s", result.Error) } else {
            for _, f := range(dbfac) {
                members := []string{}
                for _, m := range(f.Members) {
                    members = append(members, m.Username)
                }
                factions = append(factions, factionJSON{
                    Name: f.Name,
                    Leader: f.LeaderName,
                    Members: members,
                })
            }
        }
        users := &usersJSON{ List: userList, Factions: factions, Error: strerr }
        r.JSON(200, users)
    })

    r.Route("GET", "/data/f", func(r *goyave.Response, req *goyave.Request) {
        features := []POI{}
        db.Find(&features)
        groups := []POIGroup{}
        db.Find(&groups)
        list := &featuresJSON{ List: features, Groups: groups }
        r.JSON(200, list)
    })

    /*

    g.POST("/register", func(c *gin.Context) {
        user := c.PostForm("user")
        if userstate.HasUser(user) { c.AbortWithStatus(http.StatusInternalServerError) }
        userstate.AddUser(user, c.PostForm("passwd"), c.PostForm("mail"))
		c.String(http.StatusOK, fmt.Sprintf("User %q was created.\n", user))
    })

	g.GET("/confirm", func(c *gin.Context) {
		userstate.MarkConfirmed("bob")
		c.String(http.StatusOK, fmt.Sprintf("User bob was confirmed: %v\n", userstate.IsConfirmed("bob")))
	})

	g.GET("/remove", func(c *gin.Context) {
		userstate.RemoveUser("bob")
		c.String(http.StatusOK, fmt.Sprintf("User bob was removed: %v\n", !userstate.HasUser("bob")))
	})

	g.GET("/login", func(c *gin.Context) {
		// Headers will be written, for storing a cookie
		userstate.Login(c.Writer, "bob")
		c.String(http.StatusOK, fmt.Sprintf("bob is now logged in: %v\n", userstate.IsLoggedIn("bob")))
	})

	g.GET("/logout", func(c *gin.Context) {
		userstate.Logout(userstate.Username(c.Request))
		c.String(http.StatusOK, fmt.Sprintf("bob is now logged out: %v\n", !userstate.IsLoggedIn("bob")))
	})

	g.GET("/makeadmin", func(c *gin.Context) {
		userstate.SetAdminStatus("bob")
		c.String(http.StatusOK, fmt.Sprintf("bob is now administrator: %v\n", userstate.IsAdmin("bob")))
	})

	g.GET("/clear", func(c *gin.Context) {
		userstate.ClearCookie(c.Writer)
		c.String(http.StatusOK, "Clearing cookie")
	})

	g.GET("/data", func(c *gin.Context) {
		c.String(http.StatusOK, "user page that only logged in users must see!")
	})

	g.GET("/admin", func(c *gin.Context) {
    */
    r.Static("/static", "./static", false)
    r.Static("/", "./static", false)
}

func main() {
	// g := gin.New()

	// New permissionbolt middleware
    log.Println("Permissions:")
    var err error
	perm, err = permissionbolt.New()
	if err != nil {
		log.Fatalln(err)
	}
    log.Println("OK")

    database.RegisterModel(&POI{})
    database.RegisterModel(&POIGroup{})
    database.RegisterModel(&POIData{})
    database.RegisterModel(&User{})
    database.RegisterModel(&Faction{})
    // database.Migrate()

	// Blank slate, no default permissions
	//perm.Clear()


	// Logging middleware
	// g.Use(gin.Logger())

	// Enable the permissionbolt middleware, must come before recovery
	// g.Use(permissionHandler)

	// Recovery middleware
	// g.Use(gin.Recovery())

	// Get the userstate, used in the handlers below
	userstate = perm.UserState()


    server = socketio.NewServer(nil)
    server.OnConnect("/", func(s socketio.Conn) error {
        s.SetContext("")
        log.Println("Connected: ", s.ID())
        return nil
    })
    server.OnError("/", func(s socketio.Conn, e error) {
        fmt.Println("SocketIO error: ", e)
    })
    server.OnDisconnect("/", func(s socketio.Conn, reason string) {
        fmt.Println("Socket disconnected: ", reason)
    })
    go server.Serve()
    defer server.Close()
    // g.GET("/socket.io/*any", gin.WrapH(server))
    // g.POST("/socket.io/*any", gin.WrapH(server))

    server.OnEvent("/", "login", func(s socketio.Conn, msg string) {
        var data []string
        err := json.Unmarshal([]byte(msg), &data)
        if err == nil {
            userOK := userstate.CorrectPassword(data[0], data[1])
            fmt.Printf("Login: %q, %v.\n", data, userOK)
            if userOK {
                s.Emit("logged", "OK")
            } else {
                s.Emit("logged", "ERR")
            }
        }
    })

    if userstate.HasUser("bob") {
        userstate.Users().Set("bob", "group", "13")
        group, err := userstate.Users().Get("bob", "group")
        if err == nil { fmt.Printf("%v\n", group) }
    }

	// Serve
    fmt.Println("Start:")
    if err := goyave.Start(register); err != nil {
        os.Exit(err.(*goyave.Error).ExitCode)
    }
	// g.Run(":3033")
}
