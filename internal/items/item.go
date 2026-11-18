// Package items owns the removable SQLite example's records and persistence.
package items

type Item struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

type Repository interface {
	List() ([]Item, error)
	Add(string) (Item, error)
	Update(int64, string, bool) (Item, error)
	Delete(int64) error
	Close() error
}
