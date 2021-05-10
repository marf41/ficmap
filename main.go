package main

import (
    "os"
	"fmt"
	"log"
	"net/http"
	"strings"
    "encoding/json"
    "time"
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
)

type POIType int

const (
    Info POIType = iota
    Point
    Line
    Circle
    Polygon
)

type loginJSON struct {
    Login string `json:"l"`
    Password string `json:"p"`
    Mail string `json:"m"`
}

type Faction struct {
    gorm.Model
    Name string `gorm:"unique;not null"`
    LeaderName string
    Leader User `gorm:"foreignKey:LeaderName;references:Username"`
    Members []*User `gorm:"many2many:user_factions;references:Username"`
}

type User struct {
    Username string `gorm:"primaryKey;uniqueIndex;unique;not null"`
    Factions []*Faction `gorm:"many2many:user_factions;foreignKey:Username"`
}

type POI struct {
    gorm.Model
    Name string `gorm:"not null"`
    Polyline string `gorm:"size:255"`
    Type POIType
    OwnerName string
    Owner User `gorm:"foreignKey:OwnerName;references:Username"`
}

var userstate pinterface.IUserState
var perm *permissionbolt.Permissions

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
        w := new(http.ResponseWriter)
		if perm.Rejected(*w, req.Request()) {
            // log.Println("Rejected", req.Request().URL.Path)
			r.Status(http.StatusForbidden)
			return
		}
        next(r, req)
	}
}

func register(r *goyave.Router) {
    db := database.Conn()
    db.Config.DisableForeignKeyConstraintWhenMigrating = true
    database.Migrate()
	// Set up a middleware handler for Gin, with a custom "permission denied" message.
    r.Middleware(middleware.Gzip())
    r.Middleware(glog.Middleware(CustomFormatter))
    r.Middleware(PermissionMiddleware)
    // g.StaticFile("/", "./static/index.html")
    // g.StaticFile("/favicon.ico", "./static/favicon.ico")
    r.Route("GET", "/admin", func(r *goyave.Response, greq *goyave.Request) {
		r.String(http.StatusOK, "super secret information that only logged in administrators must see!\n\n")
		if usernames, err := userstate.AllUsernames(); err == nil {
			r.String(http.StatusOK, "list of all users: "+strings.Join(usernames, ", "))
		}
	})


	// g.GET("/user", func(c *gin.Context) {
        // c.String(http.StatusOK, userstate.Username(c.Request)) })
    r.Route("GET", "/user", func(r *goyave.Response, req *goyave.Request) {
        r.String(http.StatusOK, userstate.Username(req.Request())) })

    r.Route("GET", "/poi", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        poi := POI{}
        db.First(&poi)
        r.String(http.StatusOK, fmt.Sprintf("POI: %v", poi))
    })

    r.Route("GET", "/newpoi", func(r *goyave.Response, req *goyave.Request) {
        db := database.Conn()
        fc := &Faction{ Name: "Flying Caracans" }
        user := User{ Username: "bob", Factions: []*Faction{ fc } }
        poi := POI{ Name: "test", Owner: user }
        db.Create(&poi)
        r.String(http.StatusOK, fmt.Sprintf("POI: %v", poi))
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

    r.Static("/static", "./static", false)
    r.Static("/", "./static", false)
    /*

	g.GET("/register", func(c *gin.Context) {
		userstate.AddUser("bob", "hunter1", "bob@zombo.com")
		c.String(http.StatusOK, fmt.Sprintf("User bob was created: %v\n", userstate.HasUser("bob")))
	})

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

    g.POST("/login", func(c *gin.Context) {
        user := c.PostForm("user")
        passwd := c.PostForm("passwd")
        state := userstate.CorrectPassword(user, passwd)
        fmt.Printf("Login attempt: %q, %q, %v.\n", user, passwd, state)
        if state { userstate.Login(c.Writer, user); c.String(http.StatusOK, user)
        } else { c.AbortWithStatus(http.StatusUnauthorized) }
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

    database.RegisterModel(&POI{})
    database.RegisterModel(&User{})
    database.RegisterModel(&Faction{})

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


    server := socketio.NewServer(nil)
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
    // go server.Serve()
    // defer server.Close()
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
